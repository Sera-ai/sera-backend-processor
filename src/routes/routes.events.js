const fastifyPlugin = require('fastify-plugin');
const fs = require('fs');
const vm = require('vm')
const path = require('path');
const https = require('https');
const axios = require('axios');

async function routes(fastify, options) {
    fastify.post("/:builderId/:eventId", async (request, reply) => {
        try {
            const storedScript = fs.readFileSync(path.join(__dirname, `../event-scripts/${request.params.builderId}.js`), 'utf8');

            if (storedScript) {
                const script = new vm.Script(`
                    ${storedScript}
                    result = event_${request.params.eventId}(); // Call the function and store the result
                `);

                const context = new vm.createContext({
                    axios: axios,
                    https: https,
                });

                const result = await script.runInContext(context);
                reply.send(result);
            }else{
                console.log("No stored script")
                reply.send("no")
            }


        } catch (e) {
            reply.send(e);
        }
    });
}


module.exports = fastifyPlugin(routes);
