import 'dotenv/config';
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyFormbody from "@fastify/formbody";
import fastifyExpress from '@fastify/express';

import buildRoutes from "./src/routes/routes.events.js";
import analyticsRoutes from "./src/routes/routes.analytics.js";

const app = Fastify();

(async () => {
  // Register plugins
  await app.register(cors, { origin: "*" });
  await app.register(fastifyFormbody);
  await app.register(fastifyExpress); // For middleware compatibility

  // Define the routes, this assumes the routes are in Fastify format.
  app.register((instance, opts, done) => {
    analyticsRoutes(instance, opts, done);
    done();
  }, { prefix: '/analytics' });

  app.register((instance, opts, done) => {
    buildRoutes(instance, opts, done);
    done();
  }, { prefix: '/events' });

  // Start the server
  const port = process.env.BE_PROCESSOR_PORT;
  app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    console.log(`Processor Started at ${port}`);
  });
})();
