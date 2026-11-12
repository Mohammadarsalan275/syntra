
import nodeemailer from 'nodemailer';
const transporter = nodeemailer.createTransport({
    user: process.env.Google_USER,
    clientSecret: process.env.Google_CLIENT_SECRET,
    refreshToken: process.env.Google_REFRESH_TOKEN,
    clientId: process.env.Google_CLIENT_ID,
})

transporter.verify()
.then(()=>{
    console.log('Ready for send emails');
})
.catch((err) =>{
    console.log(err);
})
export async function sendEmail({to, subject, text, html}) {
    const mailOptions = {
        from: process.env.Google_USER,
        to,
        subject,
        html,
        text
    };

    const details= await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + details.response);
}