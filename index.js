const QRCode = require("qrcode");
const { createCanvas, loadImage } = require("canvas");

async function generateCustomQRCode(data) {
  const canvas = createCanvas(300, 300);
  const ctx = canvas.getContext("2d");

  // Generate QR Code with custom color
  await QRCode.toCanvas(canvas, data, {
    color: {
      dark: "#34A853", // Google green color for illustration purposes
      light: "#FFFFFF",
    },
    width: 300,
    errorCorrectionLevel: "H",
  });

  // Embed a logo in the center of the QR code
  const logo = await loadImage("momo.png"); // Load your logo from a path
  const logoSize = 60; // or whatever size you want
  const logoPosition = (canvas.width - logoSize) / 2;

  ctx.drawImage(logo, logoPosition, logoPosition, logoSize, logoSize);

  // Save or export the canvas as required
  const fs = require("fs");
  const out = fs.createWriteStream(__dirname + "/qrcode_with_logo.png");
  const stream = canvas.createPNGStream();
  stream.pipe(out);
}

const data = "Hello World";

QRCode.toDataURL(data, (err, url) => {
  console.log(generateCustomQRCode(data));
});
