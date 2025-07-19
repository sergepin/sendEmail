const nodemailer = require('nodemailer');

const allowedOrigins = [
  'https://www.sergiopinzon.dev',
  'https://sergiopinzon.dev'
];

async function verifyTurnstileToken(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  
  // Usar node-fetch o https para compatibilidad con Node.js
  const https = require('https');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      secret,
      response: token,
    });

    const options = {
      hostname: 'challenges.cloudflare.com',
      port: 443,
      path: '/turnstile/v0/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.success);
        } catch (error) {
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error verifying Turnstile:', error);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  
  // Headers CORS consistentes
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, origin, X-Custom-Origin',
    'Access-Control-Max-Age': '86400'
  };

  try {
    const isAllowedOrigin = allowedOrigins.some(allowed => origin.startsWith(allowed));

    if (!isAllowedOrigin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden origin' }),
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      };
    }

    // Handle preflight OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: corsHeaders
      };
    }

    const data = JSON.parse(event.body);

    const { name, email, subject, message, 'cf-turnstile-response': turnstileToken } = data;

    if (!name || !email || !subject || !message || !turnstileToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' }),
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      };
    }

    // Verificar el token de Turnstile
    const isValidToken = await verifyTurnstileToken(turnstileToken);
    if (!isValidToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid Turnstile token' }),
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      };
    }

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Server configuration error' }),
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      };
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass }
    });

    const mailOptions = {
      from: `"Portfolio Contact" <${user}>`,
      to: 'sergepin96@gmail.com',
      replyTo: email,
      subject: `[Portfolio Contact] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' }),
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    };

  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }),
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    };
  }
};