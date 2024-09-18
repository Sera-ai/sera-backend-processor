import fastifyPlugin from 'fastify-plugin';
import axios from "axios";
import { learnOas } from "../helpers/helpers.learning.js";
import { fetchDNSHostAndEndpointDetails } from "../helpers/helpers.database.js";

const { default: dns_model } = await import("../models/models.dns.cjs");
const { default: hosts_model } = await import("../models/models.hosts.cjs");
const { default: oas_model } = await import("../models/models.oas.cjs");
const { default: sera_settings_model } = await import("../models/models.sera_settings.cjs");
const { default: tx_logs } = await import("../models/models.tx_logs.cjs");

// Function to obfuscate a string by replacing each character with a random character
const obfuscateString = (str) => {
    const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
    const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';

    return str.split('').map(char => {
        if (lowerChars.includes(char)) {
            return lowerChars[Math.floor(Math.random() * lowerChars.length)];
        } else if (upperChars.includes(char)) {
            return upperChars[Math.floor(Math.random() * upperChars.length)];
        } else if (numbers.includes(char)) {
            return numbers[Math.floor(Math.random() * numbers.length)];
        }
        return char; // Leave symbols, spaces, and other characters unchanged
    }).join('');
};

// Function to recursively obfuscate object values
const obfuscateObject = (obj) => {
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            obj[key] = obfuscateString(obj[key]);
        } else if (typeof obj[key] === 'object') {
            obfuscateObject(obj[key]);
        }
    }
};

async function routes(fastify, options) {
    fastify.post("/new", async (request, reply) => {
        const settingsDoc = await sera_settings_model.findOne({ user: "admin" });
        const settings = settingsDoc ? settingsDoc.toObject() : {};
        // Destructure the settings safely
        const {
            systemSettings: {
                seraSettings = {},
                proxySettings = {},
                dnsSettings = {}
            } = {}
        } = settings;

        if (proxySettings.logAllRequests) {
            if (proxySettings.obfuscateLogData) {
                // Obfuscate the request and response fields
                obfuscateObject(request.body.request);
                obfuscateObject(request.body.response);
            }
            // Log the obfuscated request data
            try {
                const data = new tx_logs(request.body);
                await data.save();
            } catch (error) {
                console.error('An error occurred while saving the data');
            }
        }
        const { protocol = "https", hostname, path, method } = request.body;

        const clean_hostname = cleanUrl(hostname);

        if (method.toLowerCase() == "options") {
            console.log("optioned")
            return reply.send({
                result: false,
                message: "Ignore options",
            });
        }

        if (!clean_hostname) {
            return reply.send({
                result: false,
                message: "Invalid hostname",
            });
        }

        const urlData = {
            protocol,
            hostname: clean_hostname,
            path,
            method,
            url: `${protocol}://${clean_hostname}${path}`,
        };

        const seraHostData = async () => {

            function generateRandomString(length = 12) {
                const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
                let result = "";
                for (let i = 0; i < length; i++) {
                    const randomIndex = Math.floor(Math.random() * chars.length);
                    result += chars[randomIndex];
                }
                return result;
            }

            const seraHost = await fetchDNSHostAndEndpointDetails(urlData);
            if (!seraHost.success && seraHost.error === "Host does not exist") {

                const subdo = `${clean_hostname.split(".")[0]}-${generateRandomString(6)}`;

                const dns = new dns_model({
                    "sera_config": {
                        "domain": clean_hostname,
                        "expires": null,
                        "sub_domain": subdo,
                        "obfuscated": null
                    },
                });


                const oas = new oas_model({
                    openapi: "3.0.1",
                    info: {
                        title: "Minimal API",
                        version: "1.0.0",
                    },
                    servers: [{ url: clean_hostname }],
                    paths: {},
                });

                const dns_res = (await dns.save()).toObject();
                const oas_res = (await oas.save()).toObject();


                const host = new hosts_model({
                    oas_spec: oas_res._id,
                    dns_model: dns_res._id,
                    frwd_config: {
                        host: clean_hostname.split(":")[0],
                        port: clean_hostname.split(":")[1] ?? (protocol == "https" ? 443 : 80),
                    },
                    sera_config: {
                        strict: false,
                        learn: true,
                        https: true,
                        drift: true,
                    },
                    hostname: clean_hostname,
                });
                const host_res = (await host.save()).toObject();
                let modifyRes = { ...host_res };
                modifyRes.oas_spec = oas_res;
                modifyRes.dns_model = dns_res;
                return modifyRes;
                // build the whole thing!

            } else {
                if (!seraHost.success) {
                    console.log("seraHost Error", seraHost.error)
                    return false
                } else {
                    return seraHost;
                }
            }
        };


        const seraHost = await seraHostData();


        if (!seraHost) {
            return reply.send({
                result: false,
                message: "No Host Data",
            });
        }


        const learnRes = await learnOas({ seraHost, urlData, response: request.body.response, req: request.body.request });
        reply.send(learnRes);
    });
}

function cleanUrl(url) {
    // This regex matches "http://", "https://", and "www." at the beginning of the string
    const pattern = /^(https?:\/\/)?(www\.)?/;
    return url.replace(pattern, "");
}

export default fastifyPlugin(routes);
