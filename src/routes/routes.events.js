const fastifyPlugin = require('fastify-plugin');

const tx_Log = require("../models/models.tx_logs");
const sera_dns = require("../models/models.dns");
const sera_host = require("../models/models.hosts");
const sera_oas = require("../models/models.oas");
const sera_settings = require("../models/models.sera_settings");


async function routes(fastify, options) {
    fastify.post("/", async (request, reply) => {
        reply.send("ok");
    });
}


module.exports = fastifyPlugin(routes);
