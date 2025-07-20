const nodemailer = require('nodemailer');

async function verifyTurnstileToken(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token })
  });

  const data = await response.json();
  return data.success;
}

exports.handler = async (event) => {
  // IMPORTANT: All CORS handling (Access-Control-Allow-Origin, Methods, Headers, Max-Age)
  // should be configured directly on the Lambda Function URL in the AWS Console.
  // The Function URL itself will handle the OPTIONS preflight request and add
  // the necessary CORS headers to all responses.
  // Do NOT add CORS headers manually in the code if the Function URL is configured for CORS.

  // The 'event.httpMethod === 'OPTIONS'' block is no longer needed here
  // as the Function URL handles the preflight.

  try {
    // Validate and parse input
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' }, // Only Content-Type for the response body
        body: JSON.stringify({ message: 'Missing request body' })
      };
    }

    const data = JSON.parse(event.body);
    const { name, email, subject, message, 'cf-turnstile-response': turnstileToken } = data;

    if (!name || !email || !subject || !message || !turnstileToken) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing required fields' })
      };
    }

    const isValidToken = await verifyTurnstileToken(turnstileToken);
   if (!isValidToken) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Invalid Turnstile token' })
      };
    } 

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      console.error('Environment variables EMAIL_USER or EMAIL_PASS are not set.');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Server configuration error: Email credentials missing.' })
      };
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use 'true' if connecting to port 465 (SMTPS)
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false // Consider removing in production if certificates are valid
      }
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Email sent successfully' })
    };
  } catch (error) {
    console.error('Lambda execution error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'An internal server error occurred. Please try again later.'
      })
    };
  }
};