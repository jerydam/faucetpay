// sync_faucets.js
require('dotenv').config();
const { Web3 } = require('web3');
const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ABIs ---
const FACTORY_ABI = [
    {
        "inputs": [],
        "name": "getAllFaucets",
        "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
        "stateMutability": "view",
        "type": "function"
    }
];

const FAUCET_ABI = [
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// --- Network Configuration (Includes ALL factory addresses) ---
const NETWORKS = [
    {
        name: "Celo",
        chainId: 42220,
        rpcUrls: ["https://forno.celo.org"],
        // The list of ALL factories to scan
        factoryAddresses: [
            "0x17cFed7fEce35a9A71D60Fbb5CA52237103A21FB",
            "0xB8De8f37B263324C44FD4874a7FB7A0C59D8C58E",
            "0xc26c4Ea50fd3b63B6564A5963fdE4a3A474d4024",
            "0x9D6f441b31FBa22700bb3217229eb89b13FB49de",
            "0xE3Ac30fa32E727386a147Fe08b4899Da4115202f",
            "0xF8707b53a2bEc818E96471DDdb34a09F28E0dE6D",
            "0x8D1306b3970278b3AB64D1CE75377BDdf00f61da",
            "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5",
            "0xc9c89f695C7fa9D9AbA3B297C9b0d86C5A74f534"
        ],
        // Mapping to identify types for specific addresses
        knownTypes: {
            "0xF8707b53a2bEc818E96471DDdb34a09F28E0dE6D": "droplist",
            "0x8D1306b3970278b3AB64D1CE75377BDdf00f61da": "dropcode",
            "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5": "custom"
        }
    },
    {
        name: "Lisk",
        chainId: 1135,
        rpcUrls: ["https://rpc.api.lisk.com"],
        factoryAddresses: [
            "0x96E9911df17e94F7048cCbF7eccc8D9b5eDeCb5C",
            "0x4F5Cf906b9b2Bf4245dba9F7d2d7F086a2a441C2",
            "0x21E855A5f0E6cF8d0CfE8780eb18e818950dafb7",
            "0xd6Cb67dF496fF739c4eBA2448C1B0B44F4Cf0a7C",
            "0x0837EACf85472891F350cba74937cB02D90E60A4"
        ],
        knownTypes: {
            "0x0837EACf85472891F350cba74937cB02D90E60A4": "droplist",
            "0xd6Cb67dF496fF739c4eBA2448C1B0B44F4Cf0a7C": "dropcode",
            "0x21E855A5f0E6cF8d0CfE8780eb18e818950dafb7": "custom"
        }
    },
    {
        name: "Arbitrum",
        chainId: 42161,
        rpcUrls: [
            "https://arbitrum-one.publicnode.com",
            "https://1rpc.io/arb",
            "https://rpc.ankr.com/arbitrum",
            "https://arbitrum.drpc.org",
            "https://arb1.arbitrum.io/rpc"
        ],
        factoryAddresses: [
            "0x0a5C19B5c0f4B9260f0F8966d26bC05AAea2009C",
            "0x42355492298A89eb1EF7FB2fFE4555D979f1Eee9",
            "0x9D6f441b31FBa22700bb3217229eb89b13FB49de"
        ],
        knownTypes: {
            "0x0a5C19B5c0f4B9260f0F8966d26bC05AAea2009C": "droplist",
            "0x42355492298A89eb1EF7FB2fFE4555D979f1Eee9": "dropcode",
            "0x9D6f441b31FBa22700bb3217229eb89b13FB49de": "custom"
        }
    },
    {
        name: "Base",
        chainId: 8453,
        rpcUrls: ["https://base.publicnode.com"],
        factoryAddresses: [
            "0x945431302922b69D500671201CEE62900624C6d5",
            "0xda191fb5Ca50fC95226f7FC91C792927FC968CA9",
            "0x587b840140321DD8002111282748acAdaa8fA206"
        ],
        knownTypes: {
            "0x945431302922b69D500671201CEE62900624C6d5": "droplist",
            "0xda191fb5Ca50fC95226f7FC91C792927FC968CA9": "dropcode",
            "0x587b840140321DD8002111282748acAdaa8fA206": "custom"
        }
    }
];

// --- Helper Functions ---

async function connectToNetwork(rpcUrls, networkName) {
    for (const url of rpcUrls) {
        try {
            const web3 = new Web3(url);
            await web3.eth.net.isListening();
            return web3;
        } catch (e) {
            // Continue to next URL
        }
    }
    console.error(`   ❌ All RPCs failed for ${networkName}`);
    return null;
}

async function fetchDeletedFaucets(chainId) {
    const url = `https://identical-vivi-faucetdrops-41e9c56b.koyeb.app/deleted-faucets?chainId=${chainId}`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            const addresses = Array.isArray(data) ? data : (data.deletedAddresses || []);
            return new Set(addresses.map(addr => addr.toLowerCase()));
        }
        return new Set();
    } catch (error) {
        console.error(`⚠️ Error fetching deleted faucets: ${error.message}`);
        return new Set();
    }
}

async function getFaucetDetails(web3, faucetAddress) {
    try {
        const contract = new web3.eth.Contract(FAUCET_ABI, faucetAddress);
        const [name, owner] = await Promise.all([
            contract.methods.name().call(),
            contract.methods.owner().call()
        ]);
        return { name, owner };
    } catch (error) {
        return null;
    }
}

async function processNetwork(network) {
    console.log(`\n🌐 Processing ${network.name} (Chain ID: ${network.chainId})...`);

    const web3 = await connectToNetwork(network.rpcUrls, network.name);
    if (!web3) return;

    const deletedFaucets = await fetchDeletedFaucets(network.chainId);
    console.log(`   🗑️  Loaded ${deletedFaucets.size} deleted faucets.`);

    const faucetsToUpload = [];

    // --- CHANGED: Iterate over ARRAY of addresses instead of object keys ---
    for (const factoryAddress of network.factoryAddresses) {
        // Determine type: check known map, else default to 'legacy' (or assume droplist)
        const faucetType = network.knownTypes[factoryAddress] || 'legacy_droplist'; 
        
        console.log(`   🏭 Checking factory (${faucetType}): ${factoryAddress}`);

        try {
            const code = await web3.eth.getCode(factoryAddress);
            if (code === '0x' || code === '0x0') {
                console.log(`      ⚠️ Contract does not exist at ${factoryAddress}. Skipping.`);
                continue;
            }

            const factory = new web3.eth.Contract(FACTORY_ABI, factoryAddress);
            const deployedFaucets = await factory.methods.getAllFaucets().call();
            
            console.log(`      ↳ Found ${deployedFaucets.length} faucets.`);

            const BATCH_SIZE = 5;
            for (let i = 0; i < deployedFaucets.length; i += BATCH_SIZE) {
                const batch = deployedFaucets.slice(i, i + BATCH_SIZE);
                
                await Promise.all(batch.map(async (faucetAddr) => {
                    const normalizedAddr = faucetAddr.toLowerCase();
                    if (deletedFaucets.has(normalizedAddr)) return;

                    const details = await getFaucetDetails(web3, faucetAddr);
                    
                    if (details) {
                        const normalizedOwner = details.owner.toLowerCase();
                        faucetsToUpload.push({
                            faucet_address: normalizedAddr,
                            owner_address: normalizedOwner,
                            chain_id: network.chainId,
                            faucet_type: faucetType,
                            name: details.name,
                            created_at: new Date().toISOString()
                        });
                    }
                }));
            }

        } catch (error) {
            console.error(`   ❌ Error with factory ${factoryAddress}: ${error.message}`);
        }
    }

    if (faucetsToUpload.length > 0) {
        console.log(`   💾 Upserting ${faucetsToUpload.length} faucets...`);
        try {
            const { error } = await supabase
                .from('userfaucets')
                .upsert(faucetsToUpload, { onConflict: 'faucet_address' });

            if (error) throw error;
            console.log(`   ✅ Successfully synced ${network.name}!`);
        } catch (error) {
            console.error(`   💥 Database Upload Error: ${error.message}`);
        }
    } else {
        console.log(`   ℹ️  No new valid faucets found for ${network.name}.`);
    }
}

async function main() {
    console.log("🚀 Starting Faucet Sync Script...");
    const startTime = Date.now();
    await Promise.all(NETWORKS.map(network => processNetwork(network)));
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Sync completed in ${duration} seconds.`);
}

main().catch(console.error);