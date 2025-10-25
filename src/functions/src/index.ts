// import * as functions from 'firebase-functions';
// import * as admin from 'firebase-admin';
// import * as nodemailer from 'nodemailer';

// admin.initializeApp();

// // Configure email transporter (use Gmail, SendGrid, or your SMTP)
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: 'your-email@gmail.com',
//     pass: 'your-app-password' // Use App Password, not regular password
//   }
// });

// // Trigger when invitation is created
// export const sendInvitationEmail = functions.firestore
//   .document('invitations/{invitationId}')
//   .onCreate(async (snap, context) => {
//     const invitation = snap.data();
    
//     // Create invitation link
//     const inviteLink = `https://splitsync.vercel.app/accept-invite/${snap.id}`;
    
//     const mailOptions = {
//       from: 'SplitSync <your-email@gmail.com>',
//       to: invitation.personEmail,
//       subject: `${invitation.invitedByName} invited you to ${invitation.diaryName}`,
//       html: `
//         <!DOCTYPE html>
//         <html>
//         <head>
//           <style>
//             body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
//             .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//             .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
//             .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
//             .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
//             .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
//           </style>
//         </head>
//         <body>
//           <div class="container">
//             <div class="header">
//               <h1>💰 You're Invited to SplitSync!</h1>
//             </div>
//             <div class="content">
//               <p>Hi there!</p>
              
//               <p><strong>${invitation.invitedByName}</strong> has invited you to join the diary <strong>"${invitation.diaryName}"</strong> on SplitSync.</p>
              
//               <p>SplitSync makes it easy to track shared expenses and settle up with friends!</p>
              
//               <center>
//                 <a href="${inviteLink}" class="button">Accept Invitation</a>
//               </center>
              
//               <p style="font-size: 12px; color: #666;">Or copy this link: <br><code>${inviteLink}</code></p>
              
//               <p>See you there! 🎉</p>
//             </div>
//             <div class="footer">
//               <p>This invitation was sent by SplitSync | <a href="https://splitsync.vercel.app">splitsync.vercel.app</a></p>
//             </div>
//           </div>
//         </body>
//         </html>
//       `
//     };
    
//     try {
//       await transporter.sendMail(mailOptions);
//     } catch (error) {
//       console.error('❌ Error sending email:', error);
//     }
//   });