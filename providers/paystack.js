const axios = require("axios");

const resolveAccountNumber = async (accountNumber) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=120003`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Error resolving account number: ${error}`);
    return null;
  }
};

module.exports = resolveAccountNumber;
