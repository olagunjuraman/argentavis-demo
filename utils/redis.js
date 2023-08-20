const redis = require("redis");

const redisClient = redis.createClient({
  url: "redis://default:NkVfbZuxYWn9OisU3KiHpN39BjkjdDb2@redis-17243.c9.us-east-1-4.ec2.cloud.redislabs.com:17243",
});

redisClient.connect().then((client) => {
  console.info("connected redis client");
});

redisClient.on("error", (error) => {
  console.error("Redis Error:", error);
});

module.exports = redisClient;
