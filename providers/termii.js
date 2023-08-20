const axios = require("axios");

const baseUrl = "https://api.ng.termii.com";

const sendSms = async (input) => {
  try {
    const requestBody = {
      to: `${input.phoneNumber}`,
      from: process.env.TERMII_SENDER,
      sms: input.message,
      type: "plain",
      api_key: process.env.TERMII_SECRET_KEY,
      channel: "dnd",
    };

    const axiosResponse = await axios.post(
      `${baseUrl}/api/sms/send`,
      requestBody,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    return axiosResponse.data;
  } catch (error) {
    throw error;
  }
};

module.exports = sendSms;
