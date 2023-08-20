const mongoose = require("mongoose");

const qrSchema = new mongoose.Schema({
  uuid: String,
  s3URL: String,
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  accountNumber: { type: String, default: "" },
  isActivated: { type: Boolean, default: false },
});

const QRCodeModel = mongoose.model("QRCode", qrSchema);

module.exports = QRCodeModel;
