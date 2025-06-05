const nodemailer = require('nodemailer');

const allowedOrigins = [
  'https://www.sergiopinzon.dev',
  'https://sergiopinzon.dev'
];

exports.handler = async (event) => {
  try {
    const origin = event.headers?.origin || '';

    const isAllowedOrigin = allowedOrigins.some(allowed => origin.startsWith(allowed));

    if (!isAllowedOrigin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden origin' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Handle preflight OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      };
    }

    const data = JSON.parse(event.body);

    const { name, email, subject, message } = data;

    if (!name || !email || !subject || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin
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
          'Access-Control-Allow-Origin': origin
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
        'Access-Control-Allow-Origin': origin
      }
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
