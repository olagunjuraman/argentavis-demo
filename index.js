const express = require("express");
const QRCode = require("qrcode");
const { createCanvas, loadImage } = require("canvas");
const AWS = require("aws-sdk");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const qrQueue = require("./queue");

dotenv.config({});

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

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// 3. Mongoose Schema and Model
const qrSchema = new mongoose.Schema({
  uuid: String,
  s3URL: String,
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  accountNumber: { type: String, default: "" },
  isActivated: { type: Boolean, default: false },
});

const QRCodeModel = mongoose.model("QRCode", qrSchema);

qrQueue.process(async (job) => {
  try {
    const uuid = uuidv4();
    const data = `https://momo-payment-48xe4nhf9-iamswart.vercel.app/?uuid=${uuid}`;
    const buffer = await generateCustomQRCode(data);
    const s3Link = await uploadToS3(buffer, `qrcodes/${Date.now()}.png`);
    const qrEntry = new QRCodeModel({ uuid, s3URL: s3Link });
    await qrEntry.save();
    return { uuid, s3URL: s3Link };
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

async function uploadToS3(buffer, key) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: "image/png",
  };

  return new Promise((resolve, reject) => {
    s3.upload(params, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data.Location);
      }
    });
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

app.post("/activate", async (req, res) => {
  const { id, firstName, lastName, accountNumber } = req.body;

  if (!id || !firstName || !lastName || !accountNumber) {
    return res.status(400).json({
      message:
        "All fields (id, firstName, lastName, accountNumber) are required.",
    });
  }

  try {
    const qrModel = await QRCodeModel.findOne({ uuid: id });

    if (!qrModel) {
      return res.status(404).json({ message: "QR Code not found." });
    }

    // Update the QR code model
    await qrModel.updateOne({
      isActivated: true,
      firstName: firstName,
      lastName: lastName,
      accountNumber: accountNumber,
    });

    res.json({ message: "Activation successful" });
  } catch (error) {
    console.error("Error activating QR code:", error);
    res.status(500).json({ message: "Server error" });
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
