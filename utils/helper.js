 const generateOtp = () => {
  return `${Math.floor(Math.random() * 10)}${Math.floor(
    Math.random() * 10
  )}${Math.floor(Math.random() * 10)}${Math.floor(
    Math.random() * 10
  )}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}`;
};

 const formatNumber = (input) => {
  return `+${234}${Number(input)}`;
};

module.exports = {
    generateOtp,
    formatNumber
}
