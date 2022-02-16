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
const X_CONTENT_TYPE = 'content-type';

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
			passphrase: {
				type: String,
				required: false,
				default: '',
				trim: true		
			},
			ip: {
				type: [String],
				required: false,
				default: null
			},
			authorized: {
				type: Boolean,
				required: true,
				default: false
			},
			scopes: {
				type: [String],
				required: false,
				default: []
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

					const output = await this.ingress(input.client, input.privateCertificate, input.publicCertificate, input.ip, input.passphrase);

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

				//delete previous[current.endpoint].endpoint;

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
	async ingress (__client, __privateCertificate, __publicCertificate, __ip, __passphrase) {

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

		const key = uuidv4();

		const input = {
			client: __client,
			key: key,
			privateCertificate: __privateCertificate,
			publicCertificate: __publicCertificate,
			ip: __ip,
			scopes: [],
			authorized: false,
			passphrase: __passphrase || null
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
	 *
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

				//delete this.endpoints[__endpoint].endpoint;

			} catch (mongooseError) {

				throw mongooseError;

			}

		}

		try {

			const uri = `/${AIPIM}/${this.data.name}/${this.data.version}/${__endpoint}`;
			
			const verb = __verb.trim().toLowerCase();

			const binder = {
				scope: this,
				handler: __handler,
				endpoint: this.endpoints[__endpoint]
			};

			const aipimVerbHandler = this[verb.toUpperCase()].bind(binder);

			const responseHandlers = [
				jsonParser,
				this.isValid.bind(binder),
				aipimVerbHandler
			];

			// why this.express[verb] does not work?

			switch (verb) {

				case 'get':
					this.express.get(uri, responseHandlers);
				return;

				case 'post':
					this.express.post(uri, responseHandlers);
				return;

			}

			// ADD get /signature with api IO function.explain = controller.get(....)*/

		} catch (error) {

			throw error;

		}

	}

	/**
	 * 
	 */ 
	isValid (request, response, next) {

		if (!this.scope.clients) {

			response.status(500).json({
				error: 'Cannot validate - Aipim.clients is not initialized!'
			});

			return;
		
		} else {

			const headersValidation = [
				request.headers.hasOwnProperty(X_AIPIM),
				request.headers[X_AIPIM],
				request.headers.hasOwnProperty(X_AIPIM_KEY),
				request.headers[X_AIPIM_KEY],
				request.headers.hasOwnProperty(X_AIPIM_CLIENT),
				request.headers[X_AIPIM_CLIENT],
				request.headers.hasOwnProperty(X_CONTENT_TYPE),
				request.headers[X_CONTENT_TYPE]
			].reduce((previous, current) => {

				return previous && !!current;

			}, true);

			if (headersValidation) {

				const me = this.scope.clients[request.headers[X_AIPIM_CLIENT]];

				if (!me) {

					response.status(404).json({
						error: 'You ain\'t a client...'
					});

					return;

				} else {

					if (me.authorized === true) {

						if (this.endpoint.input === request.headers[X_CONTENT_TYPE]) {

							if (me.key === request.headers[X_AIPIM_KEY]) {

								try {

									const decrypted = this.scope.decrypt(request.headers[X_AIPIM_CLIENT], request.headers[X_AIPIM]);

									if (me.key === decrypted) {

										next();

									} else {

										response.status(401).json({
											error: 'Whose cloak is this?!'
										});

										return;

									}

								} catch (dError) {

									response.status(500).json({
										error: dError.toString()
									});

									return;

								}

							} else {

								response.status(401).json({
									error: 'You ain\'t you!'
								});

								return;

							}

						} else {

							response.status(400).json({
								error: `We need a ${this.endpoint.input} content-type header`
							});

							return;

						}

					} else {

						response.status(401).json({
							error: `You ain't authorized yet!`
						});

						return;

					}

				}

			} else {

				response.status(400).json({
					error: 'Missing 4 headers, my dear!'
				});

				return;

			}

		}

	}

	/**
	 * 
	 */
	async GET (request, response) {

		let output = null;

		if ((!this.handler) || (!(this.handler instanceof Function))) {

			response.status(500).json({
				error: 'Handler does not exist or is not a function'
			});

			return;

		}

		try {

			output = await this.handler();

		} catch (handlerError) {

			response.status(500).json({
				error: handlerError.toString()
			});

			return;

		}

		if ((output === null) || (output === undefined)) {

			response.status(403).json({
				error: 'Output is null or undefined, maybe an internal error in API method?'
			});

			return;

		} else {

			if (typeof(output) !== 'object') {

				response.status(500).json({
					error: 'Output is not an object to be stringified - please call the programmer and report that output is not a string'
				});

				return;

			} else {

				try {

					const signature = this.scope.sign(request.headers[X_AIPIM_CLIENT]);

					//console.log('verf', this.scope.verify(request.headers[X_AIPIM_CLIENT], signature));

					if (this.endpoint.output === 'application/json') {

						output = JSON.stringify(output);

					}

					try {

						//output = this.scope.encrypt(request.headers[X_AIPIM_CLIENT], output); :-( buaaaa! - This remains here for when I can encrypt data
						// Error: error:0409A06E:rsa routines:RSA_padding_add_PKCS1_OAEP_mgf1:data too large for key size

						response.status(200).setHeader('content-type', this.endpoint.output).setHeader(X_AIPIM_SIGNATURE, signature).send(output);

						return;

					} catch (encryptError) {

						console.log(encryptError);

						response.status(500).json({
							error: encryptError.toString()
						});

						return;

					}

				} catch (encryptError) {

					response.status(500).json({
						error: encryptError.toString()
					});

					return;

				}

			}

		}

	}

	/**
	 * 
	 */
	async POST (request, response) {

		if ((!this.handler) || (!(this.handler instanceof Function))) {

			response.status(500).json({
				error: 'Handler does not exist or is not a function'
			});

			return;

		}

		if (!request.body) {

			response.status(403).json({
				error: 'Your body empty. Posting nothing?!'
			});

			return;

		}

		let input = request.body;

		// REMEMBER TO THINK ABOUT THIS CONSIDERING jsonParser :: if (this.endpoint.input === 'application/json')

		let output = null;

		try {

			output = await this.handler(input);

		} catch (handlerError) {

			response.status(handlerError.code || 500).json({
				error: handlerError.toString()
			});

			return;

		}

		if (output === null) {

			response.status(403).json({
				error: 'Output is null, maybe an internal error in API method?'
			});

			return;

		} else {

			if (this.endpoint.output === 'application/json') {

				output = JSON.stringify(output);

			}

			try {

				const signature = this.scope.sign(request.headers[X_AIPIM_CLIENT]);

				//output = this.scope.encrypt(request.headers[X_AIPIM_CLIENT], output); :-( buaaaa! - This remains here for when I can encrypt data
				// Error: error:0409A06E:rsa routines:RSA_padding_add_PKCS1_OAEP_mgf1:data too large for key size

				response.status(200).setHeader('content-type', this.endpoint.output).setHeader(X_AIPIM_SIGNATURE, signature).send(output);

				return;

			} catch (encryptError) {

				response.status(encryptError.code || 500).json({
					error: encryptError.toString()
				});

				return;

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

		return AipimDecrypt(data, me.privateCertificate, me.passphrase);

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

		//console.log(data);

		return AipimSign(data, me.privateCertificate, me.passphrase);

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
const AipimDecrypt = (data, privateCertificate, passphrase) => {

	if ((!data) || (!privateCertificate)) {

		throw new Error('Data, Private Certificate must be set! Passphrase is optional.');

	}

	if ((typeof(data) !== 'string') || (typeof(privateCertificate) !== 'string') || (typeof(passphrase) !== 'string')) {

		throw new Error('Data, Private Certificate and Passphrase must be string!');

	}

	const buffer = Buffer.from(data, 'base64');

	const decrypted = crypto.privateDecrypt({
		key: privateCertificate,
		oaepHash: ALGORITHM,
		padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
		passphrase: passphrase
	}, buffer);

	return decrypted.toString('utf-8');

};

/**
 * 
 */
const AipimSign = (data, privateCertificate, passphrase) => {

	if ((!data) || (!privateCertificate)) {

		throw new Error('Data and Private Certificate must be set! Passphrase is optional.');

	}

	if ((typeof(data) !== 'string') || (typeof(privateCertificate) !== 'string') || (typeof(passphrase) !== 'string')) {

		throw new Error('Data and Private Certificate must be string!');

	}

	const signature = crypto.sign(ALGORITHM, Buffer.from(data), {
		key: privateCertificate,
		padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
		passphrase: passphrase
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
const AipimIngress = async (client, url, privateCertificate, publicCertificate, ip, passphrase) => {

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

	try {

		const response = await Axios({
			url: url,
			method: 'POST',
			headers: {
				'Content-type': 'application/json'
			},
			data: {
				client: client,
				privateCertificate: privateCertificate,
				publicCertificate: publicCertificate,
				ip: ip,
				passphrase: passphrase || ''
			}
		});

		console.log('[AIPIMIngress::SUCCESS] ----------------------------------------------');
		console.log(response.status);
		console.log(response.data);
		console.log('[AIPIMIngress::SUCCESS] ----------------------------------------------');

		return response.data;

	} catch (requestError) {

		console.log('[AIPIMIngress::ERROR] ----------------------------------------------');
		console.log(requestError.response?.data || requestError.toString());
		console.log('[AIPIMIngress::ERROR] ----------------------------------------------');
		
		return requestError;

	}

};

/**
 * 
 */ 
const AipimNoRouteHandler = async () => {

	// TODO

};

module.exports = {Aipim, AipimEncrypt, AipimDecrypt, AipimIngress, AipimNoRouteHandler};
