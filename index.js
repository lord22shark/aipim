/**
 * AIPIM
 */ 

/* External Dependencies */
const Axios = require("axios");
const BodyParser = require('body-parser');
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const {v4: uuidv4} = require('uuid');

/* Internal Dependencies */

const AIPIM = 'aipim';
const X_AIPIM = 'x-aipim';
const X_AIPIM_KEY = 'x-aipim-key';
const X_AIPIM_CLIENT = 'x-aipim-client';
const X_AIPIM_SIGNATURE = 'x-aipim-signature';

const ALGORITHM = 'sha512';

/**
 * Parser
 */ 
const jsonParser = BodyParser.json({
	limit: '5mb'
});

/**
 * Main Class
 */
class Aipim {

	/**
	 * 
	 */
	constructor (__name, __version, __express, __mongoose) {

		// TODO: instead of get name... get all from database and "add" autimatically. 2.0.0

		if ((!__express) || (!(__express instanceof Object))) {

			throw new Error('Express must be an instance of ExpressJS');

		}

		if ((!__mongoose) || (!(__mongoose instanceof Object))) {

			throw new Error('Mongoose must be an instance of Mongoose');

		}

		if ((!__name) || (!/[a-z0-9\_]/g.test(__name))) {

			throw new Error('API\'s name must be set and lowercase.');

		}
		
		this.name = __name;
		
		this.express = __express;

		this.version = __version || '1.0.0';
		
		this.clients = [];

		// Mongoose

		this.Mongoose = __mongoose;

		/**
		 *
		 */ 
		const endpointSchema = new this.Mongoose.Schema({
			verb: {
				type: String,
				required: true,
				trim: true
			},
			endpoint: {
				type: String,
				required: true,
				unique: true,
				trim: true
			},
			input: { // Mimetype
				type: String,
				required: true,
				trim: true
			},
			output: { // Mimetype
				type: String,
				required: true,
				trim: true
			}
		});

		/**
		 *
		 */ 
		const clientSchema = new this.Mongoose.Schema({
			client: {
				type: String,
				required: true,
				index: true,
				unique: true,
				default: null,
				trim: true
			},
			key: {
				type: String,
				required: true,
				index: true,
				unique: true,
				default: null,
				trim: true		
			},
			privateCertificate: {
				type: String,
				required: true,
				index: true,
				unique: true,
				default: null,
				trim: true		
			},
			publicCertificate: {
				type: String,
				required: true,
				index: true,
				unique: true,
				default: null,
				trim: true		
			},
			ip: {
				type: [String],
				required: false,
				default: null
			}
		});

		/**
		 * Schema - API
		 */ 
		const apiSchema = new this.Mongoose.Schema({
			name: {
				type: String,
				required: true,
				index: true,
				unique: true,
				default: null,
				trim: true,
				validate: {
					message: 'Aipim API\'s name must be lowercase, including "-" and "_".',
					validator: function (value) {

						return /[a-z\-\_]+/g.test(value);

					}
				}
			},
			version: {
				type: String,
				required: true,
				default: null,
				trim: true
			},
			endpoint: {
				type: [endpointSchema],
				required: false,
				default: null
			},
			client: {
				type: [clientSchema],
				required: false,
				index: true,
				default: null
			}
		});

		this.Model = this.Mongoose.model('Model', apiSchema, 'api');

	}

	/**
	 * 
	 */
	async init () {

		if (this.Mongoose.connection.readyState !== 1) {

			throw new Error('Mongoose is not connected to the database');

		}

		this.express.post(`/${AIPIM}/${this.name}/ingress`, [
			jsonParser,
			async (request, response) => {

				const input = request.body;

				try {

					const output = await this.ingress(input.client, input.privateCertificate, input.publicCertificate, input.ip);

					response.status(200).json(output);

				} catch (error) {

					response.status(500).json({
						error: error.toString()
					})

				}

			}
		]);

		this.data = null;

		try {

			this.data = await this.Model.findOne({name: this.name, version: this.version});

			if (!this.data) {

				this.data = new this.Model({
					name: this.name,
					version: this.version
				});

				await this.data.save();

			}

			this.clients = this.data.client.reduce((previous, current) => {

				previous[current.client] = current;

				delete previous[current.client].client;

				return previous;

			}, {});

			this.endpoints = this.data.endpoint.reduce((previous, current) => {

				previous[current.endpoint] = current;

				delete previous[current.endpoint].endpoint;

				return previous;

			}, {});

		} catch (mongooseError) {

			throw mongooseError;

		}

		return;

	} 

	/**
	 * 
	 */ 
	async ingress (__client, __privateCertificate, __publicCertificate, __ip) {

		if ((!__client) || (typeof(__client) !== 'string')) {

			throw new Error('Client should be a string for a unique identification of the client');

		}

		if ((!__privateCertificate) || (typeof(__privateCertificate) !== 'string')) {

			throw new Error('PrivateKey must be set and should be a string');

		}

		if ((!__publicCertificate) || (typeof(__publicCertificate) !== 'string')) {

			throw new Error('PublicKey must be set and should be a string');

		}

		if ((__ip) && (__ip instanceof Array) && (__ip.length === 0)) {

			throw new Error('IP must be a valid list of ip addresses if set');

		}

		if (!this.clients) {
		
			throw new Error('Cannot ingress - Aipim is not initialized!');

		}

		if (this.clients.hasOwnProperty(__client)) {

			throw new Error(`${__client} is already here? Are you really it?`);

		}

		const key = uuidv4();

		const input = {
			client: __client,
			key: key,
			privateCertificate: __privateCertificate,
			publicCertificate: __publicCertificate,
			ip: __ip
		};

		this.data.client.push(input);

		try {
		
			await this.data.save();

			this.clients[__client] = JSON.parse(JSON.stringify(input));

			delete this.clients[__client].client;

		} catch (mongooseError) {

			throw mongooseError;

		}

		return key;

	}

	/**
	 * TODO: add input and output mimetype
	 */
	async add (__verb, __endpoint, __accept, __mimetype, __handler) {

		if (!this.endpoints) {

			throw new Error('Cannot add handler - Aipim.endpoints is not initialized!');

		}

		if ((!__verb) || (typeof(__verb) !== 'string')) {

			throw new Error('First argument should be a HTTP Verb. Do you know it?');

		}

		if ((!__endpoint) || (typeof(__endpoint) !== 'string')) {

			throw new Error('Endpoint must be the last past of the URL that should be called. Lowercase, ok?!');

		}

		if ((!__accept) || (typeof(__accept) !== 'string')) {

			throw new Error('Accept must be a string with accept header mime type');

		}

		if ((!__mimetype) || (typeof(__mimetype) !== 'string')) {

			throw new Error('Mimetype must be a string with mimetype header');

		}

		if ((!__handler) || (typeof(__handler) !== 'function')) {

			throw new Error('Last argument must be a function, async, right?!');

		}

		if (!this.endpoints.hasOwnProperty(__endpoint)) {

			const input = {
				verb: __verb,
				endpoint: __endpoint,
				input: __accept,
				output: __mimetype
			};

			this.data.endpoint.push(input);

			try {

				await this.data.save();

				this.endpoints[__endpoint] = JSON.parse(JSON.stringify(input));

				delete this.endpoints[__endpoint].endpoint;

			} catch (mongooseError) {

				throw mongooseError;

			}

		}

		try {

			const uri = `/${AIPIM}/${this.data.name}/${this.data.version}/${__endpoint}`;
			
			const verb = __verb.trim().toLowerCase();

			if (verb === 'get') {

				this.express.get(uri, [
					this.isValid.bind(this), // TODO LATER BIND
					this.middlewareGet.bind({scope:this, handler: __handler, endpoint: __endpoint})
				]);

			} else if (verb === 'post') {

				this.express.get(uri, [
					this.isValid.bind(this), // TODO LATER BIND
					this.middlewarePost.bind({scope:this, handler: __handler, endpoint: __endpoint})
				])

			}

			// ADD get /signature with api IO function.explain = controller.get(....)

		} catch (error) {

			throw error;

		}

	}

	/**
	 * 
	 */ 
	isValid (request, response, next) {

		if (!this.clients) {

			response.status(500).json({
				error: 'Cannot validate - Aipim.clients is not initialized!'
			});
		
		} else {

			if (request.headers.hasOwnProperty(X_AIPIM) && (request.headers[X_AIPIM]) && request.headers.hasOwnProperty(X_AIPIM_KEY) && (request.headers[X_AIPIM_KEY]) && request.headers.hasOwnProperty(X_AIPIM_CLIENT) && (request.headers[X_AIPIM_CLIENT])) {

				const me = this.clients[request.headers[X_AIPIM_CLIENT]];

				if (!me) {

					response.status(404).json({
						error: 'You ain\'t a client...'
					});

				} else {

					if (me.key === request.headers[X_AIPIM_KEY]) {

						try {

							const decrypted = this.decrypt(request.headers[X_AIPIM_CLIENT], request.headers[X_AIPIM]);

							if (me.key === decrypted) {

								next();

								// TODO: validate input mimetype

							} else {

								response.status(401).json({
									error: 'Whose cloak is this?!'
								});

							}

						} catch (dError) {

							response.status(500).json({
								error: dError.toString()
							});

						}

					} else {

						response.status(401).json({
							error: 'You ain\'t you!'
						});

					}

				}

			} else {

				response.status(400).json({
					error: 'Missing 3 headers, my dear!'
				});

			}

		}

	}

	/**
	 * 
	 */
	async middlewareGet (request, response) {

		let output = null;

		if ((!this.handler) || (!(this.handler instanceof Function))) {

			response.status(500).json({
				error: 'Handler does not exist or is not a function'
			});

		}

		try {

			output = await this.handler();

		} catch (handlerError) {

			response.status(500).json({
				error: handlerError.toString()
			});

		}

		if (output === null) {

			response.status(403).json({
				error: 'Output is null, maybe an internal error in API method?'
			});

		} else {

			if (typeof(output) !== 'string') {

				response.status(500).json({
					error: 'Output is not a string - please call the programmer and report that output is not a string'
				});

			} else {

				try {

					const signature = this.scope.sign(request.headers[X_AIPIM_CLIENT]);

					console.log('verf', this.scope.verify(request.headers[X_AIPIM_CLIENT], signature));

					const endpoint = this.scope.endpoints[this.endpoint];

					response.status(200).setHeader('content-type', endpoint.output).setHeader(X_AIPIM_SIGNATURE, signature).send(output);

				} catch (encryptError) {

					response.status(500).json({
						error: encryptError.toString()
					});

				}

			}

		}

	}

	/**
	 * 
	 */
	async middlewarePost (request, response) {

		if ((!this.handler) || (!(this.handler instanceof Function))) {

			response.status(500).json({
				error: 'Handler does not exist or is not a function'
			});

		}

		if (typeof(request.body) !== 'string') {

			response.status(403).json({
				error: 'Your body is not a string - and it should be encrypted with you public certificate'
			});

		}

		let input = null;

		try {

			const key = this.scope.clients[request.headers[X_AIPIM_CLIENT]].privateCertificate;

			input = this.scope.decrypt(key, request.body);

		} catch (decryptError) {

			response.status(200).json({
				error: decryptError.toString()
			});

		}

		if (input === null) {

			response.status(403).json({
				error: 'Cannot invoke API due to null input - maybe failed to decrypt?!'
			});

		} else {

			let output = null;

			try {

				output = await this.handler(input);

			} catch (handlerError) {

				response.status(500).json({
					error: handlerError.toString()
				});

			}

			if (output === null) {

				response.status(403).json({
					error: 'Output is null, maybe an internal error in API method?'
				});

			} else {

				if (typeof(output) !== 'string') {

					response.status(500).json({
						error: 'Output is not a string - please call the programmer and report that output is not a string'
					});

				} else {

					try {

						output = this.scope.encrypt(request.headers[X_AIPIM_CLIENT], output);

						response.status(200).setHeader('content-type', 'text/plain').send(output);

					} catch (encryptError) {

						response.status(200).json({
							error: encryptError.toString()
						});

					}

				}

			}

		}

	} 

	/**
	 * 
	 */
	encrypt (client, data) {

		if (!this.clients) {

			throw new Error('Cannot encrypt - Aipim.clients is not initialized!');

		}

		const me = this.clients[client];

		if (!me) {

			throw new Error('Cannot encrypt - By the way, who are you?');

		}

		return AipimEncrypt(data, me.publicCertificate);

	}

	/**
	 * 
	 */
	decrypt (client, data) {

		if (!this.clients) {

			throw new Error('Cannot decrypt - Aipim.clients is not initialized!');

		}

		const me = this.clients[client];

		if (!me) {

			throw new Error('Cannot decrypt - By the way, who are you?');

		}

		return AipimDecrypt(data, me.privateCertificate);

	}

	/**
	 * 
	 */ 
	sign (client) {

		if (!this.clients) {

			throw new Error('Cannot encrypt - Aipim.clients is not initialized!');

		}

		const me = this.clients[client];

		if (!me) {

			throw new Error('Cannot sign - By the way, who are you?');

		}

		const data = `${this.name}://${client}:${me.key}/${this.version}`;

		console.log(data);

		return AipimSign(data, me.privateCertificate);

	}

	/**
	 * 
	 */ 
	verify (client, signature) {

		if (!this.clients) {

			throw new Error('Cannot encrypt - Aipim.clients is not initialized!');

		}

		const me = this.clients[client];

		if (!me) {

			throw new Error('Cannot sign - By the way, who are you?');

		}

		const data = `${this.name}://${me.name}:${me.key}/${this.version}`;

		return AipimVerify(data, signature, me.publicCertificate);

	}

}

/**
 * 
 */
const AipimEncrypt = (data, publicCertificate) => {

	if ((!data) || (!publicCertificate)) {

		throw new Error('Data and Public Certificate must be set!');

	}

	if ((typeof(data) !== 'string') || (typeof(publicCertificate) !== 'string')) {

		throw new Error('Data and Public Certificate must be string!');

	}

	const buffer = Buffer.from(data);

	const encrypted = crypto.publicEncrypt({
		key: publicCertificate,
		oaepHash: ALGORITHM,
		padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
	}, buffer);

	return encrypted.toString('base64');
	
};

/**
 * 
 */
const AipimDecrypt = (data, privateCertificate) => {

	if ((!data) || (!privateCertificate)) {

		throw new Error('Data and Private Certificate must be set!');

	}

	if ((typeof(data) !== 'string') || (typeof(privateCertificate) !== 'string')) {

		throw new Error('Data and Private Certificate must be string!');

	}

	const buffer = Buffer.from(data, 'base64');

	const decrypted = crypto.privateDecrypt({
		key: privateCertificate,
		oaepHash: ALGORITHM,
		padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
	}, buffer);

	return decrypted.toString('utf-8');

};

/**
 * 
 */
const AipimSign = (data, privateCertificate) => {

	if ((!data) || (!privateCertificate)) {

		throw new Error('Data and Private Certificate must be set!');

	}

	if ((typeof(data) !== 'string') || (typeof(privateCertificate) !== 'string')) {

		throw new Error('Data and Private Certificate must be string!');

	}

	const signature = crypto.sign(ALGORITHM, Buffer.from(data), {
		key: privateCertificate,
		padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
	});

	return signature.toString('base64');

};

/**
 * 
 */
const AipimVerify = (data, signature, publicCertificate) => {

	if ((!data) || (!publicCertificate)) {

		throw new Error('Data and Public Certificate must be set!');

	}

	if ((typeof(data) !== 'string') || (typeof(publicCertificate) !== 'string')) {

		throw new Error('Data and Public Certificate must be string!');

	}

	return crypto.verify(ALGORITHM, Buffer.from(data), {
		key: publicCertificate,
		padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
	}, Buffer.from(signature));

};

/**
 * 
 */
const AipimIngress = (client, url, privateCertificate, publicCertificate, ip) => {

	if ((!client) || (typeof(client) !== 'string')) {

		throw new Error('Client must be set and be a string');

	}

	if ((!url) || (typeof(url) !== 'string')) {

		throw new Error('URL must be set and be a string');

	}

	if ((!privateCertificate) || (typeof(privateCertificate) !== 'string')) {

		throw new Error('Private Certificate must be set and be a string');

	}

	if ((!publicCertificate) || (typeof(publicCertificate) !== 'string')) {

		throw new Error('Public Certificate must be set and be a string');

	}

	if ((ip) && !(ip instanceof Array)) {

		throw new Error('IF IP is set, must be an array of string ip addresses');

	}

	Axios({
		url: url,
		method: 'POST',
		headers: {
			'Content-type': 'application/json'
		},
		data: {
			client: client,
			privateCertificate: privateCertificate,
			publicCertificate: publicCertificate,
			ip: ip
		}
	}).then((response) => {

		console.log('[AIPIMIngress::SUCCESS] ----------------------------------------------');
		console.log(response.status);
		console.log(response.data);
		console.log('[AIPIMIngress::SUCCESS] ----------------------------------------------');

	}).catch((error) => {

		console.log('[AIPIMIngress::ERROR] ----------------------------------------------');
		console.log(error.response.status);
		console.log(error.response.data);
		console.log('[AIPIMIngress::ERROR] ----------------------------------------------');

	}).finally(() => {

		process.exit(0);

	});

};

module.exports = {Aipim, AipimEncrypt, AipimDecrypt, AipimIngress};
