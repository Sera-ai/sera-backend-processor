import fastifyPlugin from 'fastify-plugin';
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import https from 'https';
import axios from 'axios';

async function routes(fastify, options) {
    fastify.post("/:builderId/:eventId", async (request, reply) => {
        try {
            const storedScript = fs.readFileSync(path.join(__dirname, `../event-scripts/${request.params.builderId}.js`), 'utf8');

            if (storedScript) {

                console.log(typeof request.body)
                const dataParam = JSON.stringify(request.body)
                console.log(dataParam)
                const script = new vm.Script(`
                    ${storedScript}
                    result = event_${request.params.eventId}(\`${dataParam}\`); // Call the function and store the result
                `);

                const context = new vm.createContext({
                    axios: axios,
                    https: https,
                    JSON: JSON,
                });

                const result = await script.runInContext(context);
                console.log("result",result)

                reply.send(result);
            }else{
                console.log("No stored script")
                reply.send("no")
            }


        } catch (e) {
            console.log(e)
            reply.send(e);
        }
    });
}


export default fastifyPlugin(routes);
