const QRCodeModel = require("./models/qr.model");
const sendSms = require("./providers/termii");
const { formatNumber } = require("./utils/helper");

const EventEmitter = require("events");

const redisClient = require("./utils/redis");

const eventEmitter = new EventEmitter();

eventEmitter.addListener("accountResolved", async (accountDetails) => {
  const otp = generateOtp();

  const message = `Please, confirm your registered phone number on Argentavis with this code ${otp}`;

  await redisClient.set(
    `phone_verification_${accountDetails.account_number}`,
    otp,
    {
      EX: 300,
    }
  );

  const phoneNumber = formatNumber(accountDetails.account_number);
  await sendSms({ phoneNumber, message });
});

// {
//   "accountNumber": "8147111701",
//   "otp": "786334"
//  }

eventEmitter.addListener("accountVerified", async (accountDetails) => {
  try {
    const nameParts = accountDetails.data.account_name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts[1];



    const filter = { accountNumber: accountDetails.data.account_number }; // You need to specify the condition to match the document you want to update

    const qrCodeDocument = await QRCodeModel.findOne(filter);
    if (qrCodeDocument) {
      qrCodeDocument.isActivated = true;
      qrCodeDocument.firstName = firstName;
      qrCodeDocument.lastName = lastName;

      await qrCodeDocument.save();
    } else {
      console.error("QRCode document not found");
    }
  } catch (error) {
    console.error("Error activating QR code:", error);
  }
});

const generateOtp = () => {
  return `${Math.floor(Math.random() * 10)}${Math.floor(
    Math.random() * 10
  )}${Math.floor(Math.random() * 10)}${Math.floor(
    Math.random() * 10
  )}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`;
};

module.exports = eventEmitter;
