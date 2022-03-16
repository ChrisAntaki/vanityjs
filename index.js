const { mnemonicFromSeed } = require("algosdk");
const base32 = require("hi-base32");
const cluster = require("cluster");
const sha512 = require("js-sha512");
const StellarBase = require("stellar-base");

const numberOfCpus = require("os").cpus().length;

const PUBLIC_KEY_LENGTH = 32;
const ALGORAND_ADDRESS_LENGTH = 58;
const ALGORAND_CHECKSUM_BYTE_LENGTH = 4;

const prefix = process.argv[2];

if (cluster.isMaster) {
  const numberOfWorkers = numberOfCpus - 1;
  console.log(`🤖 x ${numberOfWorkers}`);

  let finished = false;
  console.time("Duration");

  // Create workers.
  const workers = [];
  for (let i = 0; i < numberOfWorkers; i++) {
    const worker = cluster.fork();
    workers.push(worker);

    worker.on("message", (msg) => {
      if (finished) {
        return;
      }
      finished = true;

      for (const worker of workers) {
        worker.kill();
      }
      console.log(`
# Address
${msg.address}

# Passphrase
${msg.passphrase}
`);
      console.timeEnd("Duration");
    });
  }
} else {
  function work() {
    for (let i = 0; i < 1000; i++) {
      const account = generateAccount();
      if (account.addr.startsWith(prefix)) {
        process.send({
          address: account.addr,
          passphrase: mnemonicFromSeed(account.sk),
        });
        break;
      }
    }
    setTimeout(work);
  }
  work();
}

function generateAccount() {
  const keys = StellarBase.Keypair.random();
  const publicKey = keys.rawPublicKey();
  const sk = keys.rawSecretKey();
  const addr = encodeAddress(publicKey);
  return { addr, sk };
}

function encodeAddress(address) {
  // compute checksum
  const checksum = genericHash(address).slice(
    PUBLIC_KEY_LENGTH - ALGORAND_CHECKSUM_BYTE_LENGTH,
    PUBLIC_KEY_LENGTH
  );
  const addr = base32.encode(concatArrays(address, checksum));

  return addr.toString().slice(0, ALGORAND_ADDRESS_LENGTH); // removing the extra '===='
}

function genericHash(arr) {
  return sha512.sha512_256.array(arr);
}

function concatArrays(...arrs) {
  const size = arrs.reduce((sum, arr) => sum + arr.length, 0);
  const c = new Uint8Array(size);

  let offset = 0;
  for (let i = 0; i < arrs.length; i++) {
    c.set(arrs[i], offset);
    offset += arrs[i].length;
  }

  return c;
}
