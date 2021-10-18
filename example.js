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
		
		fandangosAPI.add('GET', 'url-endpoint', 'application/json', 'application/json', (__input) => {

			// Must return a String

			return JSON.stringify({
				lore: 'Consequat culpa. Fugiat sunt sit officia dolore id pariatur incididunt consectetur voluptate quis in culpa officia nisi. Adipisicing nulla ea sit minim culpa enim sed eu esse occaecat non qui enim dolor culpa dolore quis laborum proident in cupidatat nostrud veniam irure eiusmod velit duis ut non nisi enim enim dolore quis in ut laborum laboris et sint eu quis veniam ea mollit dolor deserunt dolore proident nisi culpa magna nulla voluptate duis amet in sunt aliquip et culpa sint dolore voluptate quis sed non reprehenderit in ullamco voluptate in pariatur ex cillum aute est aliqua veniam qui sed eiusmod elit dolore ex nulla adipisicing incididunt ad exercitation cillum proident dolore ut aliquip mollit aliquip nulla non non ullamco et ut consectetur reprehenderit laboris ut sunt voluptate cupidatat veniam sint ex est culpa minim voluptate pariatur excepteur sed esse pariatur minim dolore ad ut reprehenderit sunt excepteur veniam do dolor aliquip velit deserunt aute dolore ea ut est amet velit proident dolor aliquip culpa minim quis incididunt dolor ex fugiat occaecat aliquip cillum excepteur ex est tempor in ex nisi ut cupidatat aute quis et in consectetur qui amet laborum consectetur eiusmod ullamco sunt officia eu ullamco sunt culpa proident.'
			});

		});

		fandangosAPI.add('POST', 'another-url-endpoint', 'application/json', 'application/json', (__input) => {

			// Must return a String

			return JSON.stringify({
				abc: 1234
			});

		});

	} catch (aError) {

		console.log('AIPIM', aError);

	}

})();


/**
 * 2) Write a code to invoke "AipimIngress" from the instance configured in step (1)
 */ 
(async () => {

	const client = 'bacozitos-application';
	const url = 'http://yourdomain/aipim/fandangos/ingress';
	const privateCertificate = fs.readFileSync('path/to/you/pkey').toString('utf-8');
	const publicCertificate = fs.readFileSync('path/to/you/cert.pub').toString('utf-8');

	const output = aipim.AipimIngress(client, url, privateCertificate, publicCertificate);

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
		}
	});

	const responseB = await axios.post({
		url: 'https://yourdomain/aipim/fandangos/1.0.0/another-url-endpoint',
		headers: {
			'X-Aipim-Key': output.key,
			'X-Aipim-Client': output.name,
			'X-Aipim': encrypted,
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