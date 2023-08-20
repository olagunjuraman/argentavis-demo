const express = require("express");
const QRCode = require("qrcode");
const { createCanvas, loadImage } = require("canvas");
const AWS = require("aws-sdk");
const eventEmitter = require("./event");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const qrQueue = require("./queue");
const resolveAccountNumber = require("./providers/paystack");
const redisClient = require("./utils/redis");
const connectDB = require("./config/db");
const QRCodeModel = require("./models/qr.model");
const cloudinary = require("cloudinary").v2;

dotenv.config({});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

connectDB();
const app = express();
const port = 3000;
const BUCKET_NAME = "qrcoded";
const MONGO_URI = process.env.MONGO_URI;
const MAX_QR_COUNT = 100;

// 2. Middleware and Configuration
app.use(express.json());

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});

const s3 = new AWS.S3();

// mongoose.connect(MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

// // 3. Mongoose Schema and Model
// const qrSchema = new mongoose.Schema({
//   uuid: String,
//   s3URL: String,
//   firstName: { type: String, default: "" },
//   lastName: { type: String, default: "" },
//   accountNumber: { type: String, default: "" },
//   isActivated: { type: Boolean, default: false },
// });

// const QRCodeModel = mongoose.model("QRCode", qrSchema);

qrQueue.process(async (job) => {
  try {
    const uuid = uuidv4();
    const data = `https://swartjide.com?uuid=${uuid}`;
    const buffer = await generateCustomQRCode(data);
    const cloudinaryLink = await uploadToCloudinary(buffer); // Notice the change here
    const qrEntry = new QRCodeModel({ uuid, s3URL: cloudinaryLink }); // Maybe rename `s3URL` to a more generic name
    await qrEntry.save();
    return { uuid, s3URL: cloudinaryLink };
  } catch (error) {
    console.log(error);
  }
});

async function generateCustomQRCode(data) {
  const canvas = createCanvas(300, 300);
  const ctx = canvas.getContext("2d");

  await QRCode.toCanvas(canvas, data, {
    color: {
      dark: "#facb05",
      light: "#044c73",
    },
    width: 300,
    errorCorrectionLevel: "H",
  });

  const logo = await loadImage("momo.png");
  const logoSize = 60;
  const logoPosition = (canvas.width - logoSize) / 2;

  ctx.drawImage(logo, logoPosition, logoPosition, logoSize, logoSize);

  return canvas.toBuffer();
}

// async function uploadToS3(buffer, key) {
//   const params = {
//     Bucket: BUCKET_NAME,
//     Key: key,
//     Body: buffer,
//     ContentType: "image/png",
//   };

//   return new Promise((resolve, reject) => {
//     s3.upload(params, (error, data) => {
//       if (error) {
//         reject(error);
//       } else {
//         resolve(data.Location);
//       }
//     });
//   });
// }

async function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result.url); // This will return the URL of the uploaded image on Cloudinary
      }
    });

    // Since Cloudinary's SDK expects a readable stream, we convert the buffer to one.
    const readableStream = require("stream").Readable.from(buffer);
    readableStream.pipe(uploadStream);
  });
}

// 6. API Endpoints
app.post("/generateQR", async (req, res) => {
  const count = Math.min(req.body.count || 1, MAX_QR_COUNT);
  for (let i = 0; i < count; i++) {
    await qrQueue.add({});
  }
  res.json({ message: `${count} QR Code(s) generation in process` });
});

app.get("/resolve-account", async (req, res) => {
  const qrCode = await QRCodeModel.findOne({
    uuid: req.body.id,
    isActivated: true,
  });

  if (qrCode) {
    return res.status(400).json({ message: "QR already activated" });
  }

  const accountNumber = await QRCodeModel.findOne({
    accountNumber: req.body.accountNumber,
  });

  if (accountNumber) {
    return res.status(400).json({ message: "Account number already exists" });
  }

  try {
    const accountDetails = await resolveAccountNumber(
      Number(req.body.accountNumber)
    );

    // const filter = { accountNumber: accountDetails.data.account_number }; // You need to specify the condition to match the document you want to update
    // const update = {
    //   isActivated: true,
    //   firstName: firstName,
    //   lastName: lastName,
    // };

    // await QRCodeModel.updateOne(filter, update);

    await redisClient.set(
      `resolvedName_${req.body.accountNumber}`,
      JSON.stringify(accountDetails)
    );
    eventEmitter.emit("accountResolved", accountDetails.data);
    return res.json({
      accountDetails,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.get("/verify-account", async (req, res) => {
  try {
    const otp = await redisClient.get(
      `phone_verification_${req.body.accountNumber}`
    );
    if (!otp) {
      return res.status(400).json({ message: "OTP not found" });
    }
    if (otp !== req.body.otp) {
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    const resolvedAccount = JSON.parse(
      await redisClient.get(`resolvedName_${req.body.accountNumber}`)
    );

    eventEmitter.emit("accountVerified", resolvedAccount);
    return res.json({
      message: "Account linked successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.get("/generateQR", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10; // Default limit is 10 items per page
  const skip = (page - 1) * limit;

  try {
    const qr = await QRCodeModel.find({}).limit(limit).skip(skip).exec();

    // Get total documents to calculate pages
    const totalDocs = await QRCodeModel.countDocuments();
    const totalPages = Math.ceil(totalDocs / limit);

    res.json({
      currentPage: page,
      totalDocs,
      totalPages,
      qr,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.post("/info", async (req, res) => {
  const id = req.body.id;
  const qrModel = await QRCodeModel.findOne({ uuid: id });
  res.json(qrModel);
});

// 7. Server Initialization
app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});

module.exports = {
  QRCodeModel,
};
