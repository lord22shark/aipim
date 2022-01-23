/**
 * 0) Import Aipim after configure in package.json -> "aipim": "git://github.com/lord22shark/aipim.git#main"
 */ 
const aipim = require('aipim');

/**
 * 1) Configure AIPIM inside you Express / MongoDB application - This Application is the provider!
 */ 
(async () => {

	try {

		const apiName = 'fandangos'; // Will be part of the url (endpoint) - You can configure many API's as you wish
		const apiVersion = '1.0.0'; // Will be part of the url (endpoint)

		const Application = Express(); // Initialized ExpressJS instance

		const MongooseInstance = Mongose(); // Initialized Mongoose instance

		const fandangosAPI = new aipim.Aipim(apiName, apiVersion, Application, MongooseInstance);

		await fandangosAPI.init();
		
		await fandangosAPI.add('GET', 'url-endpoint', 'application/json', 'application/json', () => {

			// Should return something compatible with mime-type

			return {
				lore: 'Consequat culpa.'
			};

		});

		await fandangosAPI.add('POST', 'another-url-endpoint', 'application/json', 'application/json', (__input) => {

			// Should return something compatible with mime-type

			return {
				abc: 1234
			};

		});

	} catch (aError) {

		console.log('AIPIM', aError);

	}

})();


/**
 * 2) Write a code to invoke "AipimIngress" from the instance configured in step (1)
 * /usr/local/Cellar/openssl\@1.1/1.1.1k/bin/openssl genrsa -des3 -out path/to/you/pkey
 * /usr/local/Cellar/openssl\@1.1/1.1.1k/bin/openssl rsa -in aipim.key.pem -outform PEM -pubout -out path/to/you/cert.pub
 * This key pair os for aipim purpose only - Generate one just for it.
 */ 
(async () => {

	const client = 'bacozitos-application';
	const url = 'http://yourdomain/aipim/fandangos/ingress';
	const privateCertificate = fs.readFileSync('path/to/you/pkey').toString('utf-8');
	const publicCertificate = fs.readFileSync('path/to/you/cert.pub').toString('utf-8');
	const passphrase = 's0m3Ran4dom0nPassword!!!';

	const output = aipim.AipimIngress(client, url, privateCertificate, publicCertificate, passphrase);

	console.log(output);

	/**
		output = {
			name: 'youer-client-name',
			key: '36738fdf-96d5-4974-a47c-d04847faed58'
		}
	 */ 

})();

/**
 * 3) Inside another application you can invoke the API :: Remember that this application must store private and public certificate
 */ 
(async () => {

	const publicCertificate = fs.readFileSync('path/to/you/cert.pub').toString('utf-8');

	const encrypted = aipim.AipimEncrypt(output.key, publicCertificate);

	const responseA = await axios.get({
		url: 'https://yourdomain/aipim/fandangos/1.0.0/url-endpoint',
		headers: {
			'X-Aipim-Key': output.key,
			'X-Aipim-Client': output.name,
			'X-Aipim': encrypted,
			'content-type': 'application/json'
		}
	});

	const responseB = await axios.post({
		url: 'https://yourdomain/aipim/fandangos/1.0.0/another-url-endpoint',
		headers: {
			'X-Aipim-Key': output.key,
			'X-Aipim-Client': output.name,
			'X-Aipim': encrypted,
			'content-type': 'application/json'
		},
		data: {
			a: 1,
			b: 2,
			c: [true],
			d: {
				e: null
			}
		}
	});

})();