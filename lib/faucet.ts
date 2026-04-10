import {Interface, type BrowserProvider, Contract, JsonRpcProvider,type Provider, ZeroAddress,type ContractTransactionResponse, isAddress, FallbackProvider, getAddress } from "ethers"
import { FAUCET_ABI_DROPCODE, FAUCET_ABI_CUSTOM, FAUCET_ABI_DROPLIST, ERC20_ABI, QUIZ_FACTORY_ABI, CHECKIN_ABI, FACTORY_ABI_DROPCODE, FACTORY_ABI_DROPLIST,QUEST_FACTORY_ABI, FACTORY_ABI_CUSTOM, STORAGE_ABI} from "./abis"
import { appendDivviReferralData, getDivviStatus, reportTransactionToDivvi, isSupportedNetwork } from "./divvi-integration"

// Fetch faucets for a specific network using getAllFaucets and getFaucetDetails
 export interface Network {
  chainId: bigint | number
  name: string
  symbol: string
  logoUrl: string
  explorerUrl: string
  iconUrl: string
  tokenAddress: string
  nativeCurrency:{ name: string; symbol: string; decimals: number }
  rpcUrl: string | string[] // 💡 UPDATED to support array
  blockExplorer?: string
  factoryAddresses: string[]
  color?: string
  isTestnet?: boolean
  storageAddress?: string
  factories?: any // Optional: if you want to use the specific factories map
}
interface FaucetMeta {
    faucetAddress: string;
    isClaimActive: boolean;
    isEther: boolean;
    createdAt: number | string;
    tokenSymbol?: string;
    name?: string;
    owner?: string;
    factoryAddress: string; // CRITICAL for step 2
}
interface DeletedFaucetResponse {
    success: boolean;
    count: number;
    deletedAddresses: string[];
}
// Factory type definitions
export type FactoryType = 'dropcode' | 'droplist' | 'custom'

// Faucet type definitions (matches factory types)
type FaucetType = 'dropcode' | 'droplist' | 'custom'



interface FaucetConfig {
  abi: any[]
}

// Helper function to get the appropriate faucet ABI based on faucet type
function getFaucetConfig(faucetType: FaucetType): FaucetConfig {
  switch (faucetType) {
    case 'dropcode':
      return { abi: FAUCET_ABI_DROPCODE }
    case 'droplist':
      return { abi: FAUCET_ABI_DROPLIST }
    case 'custom':
      return { abi: FAUCET_ABI_CUSTOM }
    default:
      throw new Error(`Unknown faucet type: ${faucetType}`)
  }
}



// Assuming these interfaces exist
interface FactoryConfig {
  abi: any; // Factory ABI
  faucetAbi: any; // 💡 NEW: Faucet ABI
  createFunction: string;
}

// Helper function to get the appropriate ABI and function based on factory type
function getFactoryConfig(factoryType: FactoryType): FactoryConfig {
  switch (factoryType) {
    case 'dropcode':
      return { 
        abi: FACTORY_ABI_DROPCODE, 
        faucetAbi: FAUCET_ABI_DROPCODE, // 💡 ADDED
        createFunction: 'createBackendFaucet' 
      }
    case 'droplist':
      return { 
        abi: FACTORY_ABI_DROPLIST, 
        faucetAbi: FAUCET_ABI_DROPLIST, // 💡 ADDED
        createFunction: 'createWhitelistFaucet' 
      }
    case 'custom':
      return { 
        abi: FACTORY_ABI_CUSTOM, 
        faucetAbi: FAUCET_ABI_CUSTOM, // 💡 ADDED
        createFunction: 'createCustomFaucet' 
      }
    default:
      throw new Error(`Unknown factory type: ${factoryType}`)
  }
}

// Helper function to determine factory type based on useBackend and custom flags
function determineFactoryType(useBackend: boolean, isCustom: boolean = false): FactoryType {
  if (isCustom) {
    return 'custom'
  }
  return useBackend ? 'dropcode' : 'droplist'
}


// Helper function to detect factory type by trying different function calls
async function detectFactoryType(provider: Provider, factoryAddress: string): Promise<FactoryType> {
  const factoryTypes: FactoryType[] = ['dropcode', 'droplist', 'custom']
  
  for (const type of factoryTypes) {
    try {
      const config = getFactoryConfig(type)
      const contract = new Contract(factoryAddress, config.abi, provider)
      
      // Try to call a function that exists in this ABI
      await contract[config.createFunction].staticCall("test", ZeroAddress, ZeroAddress)
      return type
    } catch (error: any) {
      // If the function doesn't exist, try the next type
      if (error.message?.includes('function') && error.message?.includes('not found')) {
        continue
      }
      // If it's a different error (like invalid parameters), the function exists
      return type
    }
  }
  
  // Default to dropcode if detection fails
  console.warn(`Could not detect factory type for ${factoryAddress}, defaulting to dropcode`)
  return 'dropcode'
}

export async function getFaucetDetailsFromFactory(
    factoryAddress: string, // Needed to determine type/ABI later if not cached
    faucetAddress: string,
    provider: Provider
): Promise<any> {
    try {
        console.log(`[getFaucetDetailsFromFactory] Fetching full details for ${faucetAddress} from factory ${factoryAddress}`);

        // 1. Detect faucet type using the known factory address (this is a shortcut)
        const factoryType = await detectFactoryType(provider, factoryAddress);
        const faucetType = factoryType as FaucetType;

        // 2. Call the existing getFaucetDetails function, passing the detected type
        const details = await getFaucetDetails(provider, faucetAddress, faucetType);

        // 3. Return the full details, including the factory address for context
        return {
            ...details,
            factoryAddress: factoryAddress,
            faucetType: faucetType,
        };
    } catch (error) {
        console.error(`Error in getFaucetDetailsFromFactory for ${faucetAddress}:`, error);
        throw error;
    }
}

// Helper function to detect faucet type by trying different ABIs
export async function detectFaucetType(provider: Provider, faucetAddress: string): Promise<FaucetType> {
  const faucetTypes: FaucetType[] = ['dropcode', 'droplist', 'custom']
  
  for (const type of faucetTypes) {
    try {
      const config = getFaucetConfig(type)
      const contract = new Contract(faucetAddress, config.abi, provider)
      
      // Try to call a common function that should exist in all faucet types
      await contract.name.staticCall()
      
      // If we got here, the ABI works. Let's do additional validation
      // Check for type-specific functions
      if (type === 'droplist') {
        // Droplist should have whitelist functions
        try {
          await contract.isWhitelisted.staticCall(ZeroAddress)
          return 'droplist'
        } catch {
          continue
        }
      } else if (type === 'custom') {
        // Custom should have custom claim amount functions
        try {
          await contract.getCustomClaimAmount.staticCall(ZeroAddress)
          return 'custom'
        } catch {
          continue
        }
      } else if (type === 'dropcode') {
        // Dropcode should have claimAmount but not whitelist or custom functions
        try {
          await contract.claimAmount.staticCall()
          // Make sure it doesn't have droplist or custom specific functions
          try {
            await contract.isWhitelisted.staticCall(ZeroAddress)
            continue // Has whitelist, so it's not dropcode
          } catch {
            try {
              await contract.getCustomClaimAmount.staticCall(ZeroAddress)
              continue // Has custom amounts, so it's not dropcode
            } catch {
              return 'dropcode' // No whitelist or custom functions, must be dropcode
            }
          }
        } catch {
          continue
        }
      }
    } catch (error: any) {
      continue
    }
  }
  
  // Default to dropcode if detection fails
  console.warn(`Could not detect faucet type for ${faucetAddress}, defaulting to dropcode`)
  return 'dropcode'
}

// Helper function to get faucet type from factory address and factory type
async function getFaucetTypeFromFactory(
  provider: Provider,
  faucetAddress: string,
  networks: Network[]
): Promise<FaucetType> {
  try {
    // Try to find which factory created this faucet
    for (const network of networks) {
      for (const factoryAddress of network.factoryAddresses) {
        try {
          const factoryType = await detectFactoryType(provider, factoryAddress)
          const config = getFactoryConfig(factoryType)
          const factoryContract = new Contract(factoryAddress, config.abi, provider)
          
          // Check if this faucet exists in this factory
          const faucets = await factoryContract.getAllFaucets()
          if (faucets.includes(faucetAddress)) {
            // Faucet type matches factory type
            return factoryType
          }
        } catch (error) {
          continue
        }
      }
    }
  } catch (error) {
    console.warn(`Could not determine faucet type from factory for ${faucetAddress}:`, error)
  }
  
  // Fallback to direct detection
  return await detectFaucetType(provider, faucetAddress)
}

// Mapping of networkName to native token symbol
const NATIVE_TOKEN_MAP: Record<string, string> = {
  Celo: "CELO",
  Lisk: "LISK",
  Arbitrum: "ETH",
  Base: "ETH",
}

// Interfaces
interface FaucetDetails {
  faucetAddress: string;
  owner: string;
  name: string;
  claimAmount: bigint;
  tokenAddress: string;
  startTime: bigint;
  endTime: bigint;
  isClaimActive: boolean;
  balance: bigint;
  isEther: boolean;
  useBackend: boolean;
}

export interface NameValidationResult {
  exists: boolean;
  existingFaucet?: { 
    address: string; 
    name: string; 
    owner: string 
  };
  warning?: string;
}

// Load backend address from .env
export const BACKEND_ADDRESS = process.env.BACKEND_ADDRESS || "0x9fBC2A0de6e5C5Fd96e8D11541608f5F328C0785"
export const BACKUP_BACKEND_ADDRESS = "0x3207D4728c32391405C7122E59CCb115A4af31eA" 
// Storage contract address
const STORAGE_CONTRACT_ADDRESS = "0xc26c4Ea50fd3b63B6564A5963fdE4a3A474d4024"

// transactions contract address
const CHECKIN_CONTRACT_ADDRESS = "0x051dDcB3FaeA6004fD15a990d753449F81733440"

// Celo RPC URL
const CELO_RPC_URLS = [
  "https://forno.celo.org",
  "https://rpc.ankr.com/celo",
  "https://1rpc.io/celo",
  "https://celo.drpc.org",
  "https://celo-rpc.publicnode.com"
]

// 💡 NEW: Helper function to create the right provider
export function getProviderForNetwork(network: Network | { rpcUrl: string | string[] }): JsonRpcProvider | FallbackProvider {
  const urls = Array.isArray(network.rpcUrl) ? network.rpcUrl : [network.rpcUrl];
  const validUrls = urls.filter(Boolean);
  
  if (validUrls.length === 0) {
    throw new Error("No RPC URLs provided");
  }
  
  // If only one URL, return a standard JsonRpcProvider
  if (validUrls.length === 1) {
    return new JsonRpcProvider(validUrls[0]);
  }
  
  // If multiple URLs, create a FallbackProvider for rate-limit protection
  const providers = validUrls.map(url => new JsonRpcProvider(url));
  return new FallbackProvider(providers, 1); // Quorum of 1 is usually enough for data fetching
}

if (!isAddress(BACKEND_ADDRESS)) {
  throw new Error(`Invalid BACKEND_ADDRESS in .env: ${BACKEND_ADDRESS}`)
}

const VALID_BACKEND_ADDRESS = getAddress(BACKEND_ADDRESS)
const AVAILABLE_BACKEND_ADDRESS = getAddress(BACKUP_BACKEND_ADDRESS) 
const faucetDetailsCache: Map<string, any> = new Map()

// LocalStorage keys
const STORAGE_KEYS = {
  CHECKIN_DATA: "faucet_checkin_data",
  CHECKIN_LAST_BLOCK: "faucet_checkin_last_block",
  STORAGE_DATA: "faucet_storage_data",
  STORAGE_LAST_BLOCK: "faucet_storage_last_block",
  NEW_USERS_DATA: "faucet_new_users_data",
  CACHE_TIMESTAMP: "faucet_cache_timestamp",
}

// Cache duration (1 hour)
const CACHE_DURATION = 60 * 60 * 1000

// Helper to check network
function checkNetwork(chainId: bigint | number, networkId: bigint | number): boolean {
  console.log(`Checking network: chainId=${chainId}, networkId=${networkId}`)
  return BigInt(chainId) === BigInt(networkId)
}

// Check permissions and contract state with faucet type detection
async function checkPermissions(
  provider: BrowserProvider,
  faucetAddress: string,
  callerAddress: string,
  faucetType?: FaucetType
): Promise<{ isOwner: boolean; isAdmin: boolean; isPaused: boolean }> {
  try {
    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    
    const faucetContract = new Contract(faucetAddress, config.abi, provider);
    const [owner, adminsResponse, isPaused] = await Promise.all([
      faucetContract.owner(),
      faucetContract.getAllAdmins(),
      faucetContract.paused(),
    ]);
    // Flatten the admins array
    const admins = Array.isArray(adminsResponse)
      ? adminsResponse.flat().filter((admin: string) => isAddress(admin))
      : [];
    const isAdmin = admins.some((admin: string) => admin.toLowerCase() === callerAddress.toLowerCase());
    console.log(
      `Permissions for ${callerAddress}: isOwner=${owner.toLowerCase() === callerAddress.toLowerCase()}, isAdmin=${isAdmin}, isPaused=${isPaused}`,
    );
    return {
      isOwner: owner.toLowerCase() === callerAddress.toLowerCase(),
      isAdmin,
      isPaused,
    };
  } catch (error: any) {
    console.error(`Error checking permissions for ${faucetAddress}:`, error);
    throw new Error("Failed to check permissions");
  }
}

export function getFromStorage(key: string): any {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch (error) {
    console.warn(`Error reading from localStorage key ${key}:`, error)
    return null
  }
}

export function saveToStorage(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.warn(`Error saving to localStorage key ${key}:`, error)
  }
}

function isCacheValid(): boolean {
  const timestamp = getFromStorage(STORAGE_KEYS.CACHE_TIMESTAMP)
  if (!timestamp) return false
  return Date.now() - timestamp < CACHE_DURATION
}

function updateCacheTimestamp(): void {
  saveToStorage(STORAGE_KEYS.CACHE_TIMESTAMP, Date.now())
}

// Helper to check if the network is Celo
export function isCeloNetwork(chainId: bigint): boolean {
  return chainId === BigInt(42220) // Celo Mainnet
}

// Fetch transactions data from Celo with incremental loading
export async function fetchCheckInData(): Promise<{
  transactionsByDate: { [date: string]: number }
  usersByDate: { [date: string]: Set<string> }
  allUsers: Set<string>
}> {
  try {
    const provider = getProviderForNetwork({ rpcUrl: CELO_RPC_URLS })
    const contract = new Contract(CHECKIN_CONTRACT_ADDRESS, CHECKIN_ABI, provider)
    // Check if we have cached data and if it's still valid
    const cachedData = getFromStorage(STORAGE_KEYS.CHECKIN_DATA)
    const lastBlock = getFromStorage(STORAGE_KEYS.CHECKIN_LAST_BLOCK) || 0

    let transactionsByDate: { [date: string]: number } = {}
    let usersByDate: { [date: string]: Set<string> } = {}
    let allUsers: Set<string> = new Set()

    // Load cached data if available
    if (cachedData && isCacheValid()) {
      transactionsByDate = cachedData.transactionsByDate || {}
      usersByDate = {}
      // Convert cached user data back to Sets
      Object.entries(cachedData.usersByDate || {}).forEach(([date, users]) => {
        usersByDate[date] = new Set(users as string[])
      })
      allUsers = new Set(cachedData.allUsers || [])
      console.log("Loaded cached transactions data")
    }

    // Get current block number
    const currentBlock = await provider.getBlockNumber()
    console.log(`Current block: ${currentBlock}, Last processed: ${lastBlock}`)

    // Only fetch new events if there are new blocks
    if (currentBlock > lastBlock) {
      const fromBlock = Math.max(lastBlock + 1, currentBlock - 10000) // Limit to last 10k blocks to avoid RPC issues

      console.log(`Fetching CheckedIn events from block ${fromBlock} to ${currentBlock}`)

      try {
        const filter = contract.filters.CheckedIn()
        const events = await contract.queryFilter(filter, fromBlock, currentBlock)

        console.log(`Found ${events.length} new transactions events`)

        // Process new events
        for (const event of events) {
          try {
            const block = await provider.getBlock(event.blockNumber)
            if (block && "args" in event && event.args) {
              const date = new Date(block.timestamp * 1000).toISOString().split("T")[0]
              const user = event.args.user.toLowerCase()

              // Update transactions by date
              transactionsByDate[date] = (transactionsByDate[date] || 0) + 1

              // Track users by date
              if (!usersByDate[date]) {
                usersByDate[date] = new Set()
              }
              usersByDate[date].add(user)
              allUsers.add(user)
            }
          } catch (blockError) {
            console.warn(`Error processing block ${event.blockNumber}:`, blockError)
          }
        }

        // Save updated data to localStorage
        const dataToCache = {
          transactionsByDate,
          usersByDate: Object.fromEntries(
            Object.entries(usersByDate).map(([date, users]) => [date, Array.from(users)]),
          ),
          allUsers: Array.from(allUsers),
        }

        saveToStorage(STORAGE_KEYS.CHECKIN_DATA, dataToCache)
        saveToStorage(STORAGE_KEYS.CHECKIN_LAST_BLOCK, currentBlock)
        updateCacheTimestamp()

        console.log("Updated transactions cache")
      } catch (queryError) {
        console.error("Error querying transactions events:", queryError)
        // If query fails, use cached data
      }
    }

    return { transactionsByDate, usersByDate, allUsers }
  } catch (error) {
    console.error("Error fetching transactions data:", error)

    // Return cached data if available
    const cachedData = getFromStorage(STORAGE_KEYS.CHECKIN_DATA)
    if (cachedData) {
      const usersByDate: { [date: string]: Set<string> } = {}
      Object.entries(cachedData.usersByDate || {}).forEach(([date, users]) => {
        usersByDate[date] = new Set(users as string[])
      })

      return {
        transactionsByDate: cachedData.transactionsByDate || {},
        usersByDate,
        allUsers: new Set(cachedData.allUsers || []),
      }
    }

    return { transactionsByDate: {}, usersByDate: {}, allUsers: new Set() }
  }
}

// Fetch storage contract data with incremental loading
export async function fetchStorageData(): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    const provider = getProviderForNetwork({ rpcUrl: CELO_RPC_URLS })

    // Check if storage contract exists
    const code = await provider.getCode(STORAGE_CONTRACT_ADDRESS)
    if (code === "0x") {
      console.log("Storage contract not deployed on Celo")
      return []
    }

    const contract = new Contract(STORAGE_CONTRACT_ADDRESS, STORAGE_ABI, provider)

    // Check cached data
    const cachedData = getFromStorage(STORAGE_KEYS.STORAGE_DATA)
    if (cachedData && isCacheValid()) {
      console.log("Using cached storage data")
      return cachedData.map((claim: any) => ({
        ...claim,
        amount: BigInt(claim.amount),
      }))
    }

    // Fetch all claims from storage contract
    console.log("Fetching all claims from storage contract...")
    const claims: any[] = await contract.getAllClaims()
    console.log(`Found ${claims.length} claims in storage contract`)

    // Process claims
    const formattedClaims = await Promise.all(
      claims.map(async (claim: any) => {
        let tokenSymbol = "CELO"
        let tokenDecimals = 18
        let isEther = true

        // Try to get faucet details for token info
        try {
          const faucetDetails = await getFaucetDetails(provider, claim.faucet)
          tokenSymbol = faucetDetails.tokenSymbol
          tokenDecimals = faucetDetails.tokenDecimals
          isEther = faucetDetails.isEther
        } catch (error) {
          console.warn(`Error fetching faucet details for ${claim.faucet}:`, error)
        }

        return {
          claimer: claim.claimer as string,
          faucet: claim.faucet as string,
          amount: claim.amount, // Keep as string for storage
          txHash: claim.txHash as `0x${string}`,
          networkName: claim.networkName as string,
          timestamp: Number(claim.timestamp),
          tokenSymbol,
          tokenDecimals,
          isEther,
        }
      }),
    )



    // Cache the data
    saveToStorage(STORAGE_KEYS.STORAGE_DATA, formattedClaims)
    updateCacheTimestamp()

    // Convert amounts back to BigInt for return
    return formattedClaims.map((claim) => ({
      ...claim,
      amount: BigInt(claim.amount),
    }))
  } catch (error) {
    console.error("Error fetching storage data:", error)

    // Return cached data if available
    const cachedData = getFromStorage(STORAGE_KEYS.STORAGE_DATA)
    if (cachedData) {
      return cachedData.map((claim: any) => ({
        ...claim,
        amount: BigInt(claim.amount),
      }))
    }

    return []
  }
}

export async function createCustomFaucet(
    provider: BrowserProvider,
    factoryAddress: string,
    questName: string,
    tokenAddress: string,
): Promise<string> {
    
    // --- 1. Basic Validation ---
    if (!isAddress(factoryAddress) || !isAddress(tokenAddress)) {
        throw new Error(`Invalid factory or token address provided.`);
    }
    if (!provider) {
        throw new Error("Ethers provider is not available.");
    }

    try {
        const factoryType: FactoryType = 'custom';
        // NOTE: getFactoryConfig must be a defined helper in faucet.ts
        const config = getFactoryConfig(factoryType); 

        // --- 2. Setup Signer and Contract ---
        const signer = await provider.getSigner();
        // NOTE: VALID_BACKEND_ADDRESS must be defined/imported in faucet.ts
        const backendAddress = VALID_BACKEND_ADDRESS; 
        const backendaddressess = BACKUP_BACKEND_ADDRESS; // Placeholder if you want to modify how backend address is determined
        // Factory Contract using the Signer for a write transaction
        const factoryContract = new Contract(factoryAddress, config.abi, signer);

        // --- 3. Encode Transaction Data ---
        // Assumes createCustomFaucet expects (string name, address token, address backend)
        const data = factoryContract.interface.encodeFunctionData(config.createFunction, [
            questName,
            tokenAddress,
            backendAddress,
        ]);
        
        // NOTE: If 'appendDivviReferralData' is used, uncomment and ensure it's defined/imported.
        // const dataWithReferral = appendDivviReferralData(data);
        const dataWithReferral = data; // Placeholder if referral is not used here

        console.log(`[faucet.ts: createCustomFaucet] Sending deployment transaction for ${questName}...`);
        
        // --- 4. Send Transaction ---
        const tx = await signer.sendTransaction({
            to: factoryAddress,
            data: dataWithReferral,
            // Gas estimation is typically omitted here, letting the wallet handle it, 
            // but can be added back if needed for specific chains.
        });

        // --- 5. Wait for Confirmation and Parse Event ---
        const receipt = await tx.wait();
        if (!receipt) {
            throw new Error("Transaction receipt is null.");
        }
        
        let newFaucetAddress: string | null = null;
        const factoryInterface = new Interface(config.abi);

        if (receipt.logs) {
            for (const log of receipt.logs) {
                try {
                    const parsedLog = factoryInterface.parseLog(log as any);
                    if (parsedLog && parsedLog.name === 'FaucetCreated') {
                        newFaucetAddress = parsedLog.args.faucet;
                        break;
                    }
                } catch (e) { /* ignore unrelated logs */ }
            }
        }
        
        if (newFaucetAddress) {
            console.log(`✅ New faucet deployed at: ${newFaucetAddress}`);
            return newFaucetAddress;
        }
        
        // This is a critical error path: the transaction confirmed but the event wasn't found.
        throw new Error("Deployment succeeded, but the FaucetCreated event was not found in logs.");

    } catch (error: any) {
        console.error('❌ Error deploying custom faucet (faucet.ts):', error);
        
        // NOTE: The decodeRevertError logic should be included if you need custom error decoding.
        // if (error.data && typeof error.data === "string") {
        //     throw new Error(decodeRevertError(error.data));
        // }
        
        throw new Error(error.reason || error.message || "Failed to deploy custom faucet");
    }
}

export async function checkFaucetNameExistsAcrossAllFactories(
  provider: Provider,
  factoryAddresses: string[],
  proposedName: string
): Promise<NameValidationResult & { 
  conflictingFaucets?: Array<{
    address: string
    name: string
    owner: string
    factoryAddress: string
    factoryType: FactoryType
  }>
}> {
  try {
    if (!proposedName.trim()) {
      throw new Error("Faucet name cannot be empty");
    }
    
    const normalizedProposedName = proposedName.trim().toLowerCase();
    console.log(`Checking name "${proposedName}" across ${factoryAddresses.length} factories on current network...`);

    const conflictingFaucets: any[] = [];

    // Check each factory address
    for (const factoryAddress of factoryAddresses) {
      if (!isAddress(factoryAddress)) {
        console.warn(`Invalid factory address ${factoryAddress}, skipping`);
        continue;
      }

      try {
        // Check if factory contract exists
        const code = await provider.getCode(factoryAddress);
        if (code === "0x") {
          console.warn(`No contract at factory address ${factoryAddress}`);
          continue;
        }

        // Detect factory type and get appropriate ABI
        let factoryType: FactoryType;
        let config: FactoryConfig;
        
        try {
          factoryType = await detectFactoryType(provider, factoryAddress);
          config = getFactoryConfig(factoryType);
          console.log(`Checking factory ${factoryAddress} (type: ${factoryType})`);
        } catch (error) {
          console.warn(`Could not detect factory type for ${factoryAddress}, skipping:`, error);
          continue;
        }

        const factoryContract = new Contract(factoryAddress, config.abi, provider);

        // Method 1: Try getAllFaucetDetails first (preferred method)
        try {
          console.log(`Attempting getAllFaucetDetails for factory ${factoryAddress}...`);
          const allFaucetDetails: FaucetDetails[] = await factoryContract.getAllFaucetDetails();
          
          const conflictInThisFactory = allFaucetDetails.find(faucet => 
            faucet.name.toLowerCase() === normalizedProposedName
          );
          
          if (conflictInThisFactory) {
            conflictingFaucets.push({
              address: conflictInThisFactory.faucetAddress,
              name: conflictInThisFactory.name,
              owner: conflictInThisFactory.owner,
              factoryAddress,
              factoryType
            });
          }
          
        } catch (getAllError:any) {
          console.warn(`getAllFaucetDetails failed for factory ${factoryAddress}, trying fallback method:`, getAllError.message);
          
          // Method 2: Fallback - Get all faucet addresses and check each individually
          try {
            console.log(`Attempting getAllFaucets fallback for factory ${factoryAddress}...`);
            const faucetAddresses: string[] = await factoryContract.getAllFaucets();
            
            console.log(`Found ${faucetAddresses.length} faucets in factory ${factoryAddress}`);
            
            // Check each faucet individually (with batching for performance)
            const batchSize = 10; // Process in smaller batches
            
            for (let i = 0; i < faucetAddresses.length; i += batchSize) {
              const batch = faucetAddresses.slice(i, i + batchSize);
              
              // Process batch in parallel
              const batchPromises = batch.map(async (faucetAddress) => {
                try {
                  const faucetDetails = await factoryContract.getFaucetDetails(faucetAddress);
                  return {
                    address: faucetAddress,
                    name: faucetDetails.name,
                    owner: faucetDetails.owner,
                    factoryAddress,
                    factoryType
                  };
                } catch (error: any) {
                  console.warn(`Failed to get details for faucet ${faucetAddress}:`, error.message);
                  return null;
                }
              });
              
              const batchResults = await Promise.allSettled(batchPromises);
              
              // Check this batch for name conflicts
              for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value) {
                  const faucet = result.value;
                  if (faucet.name.toLowerCase() === normalizedProposedName) {
                    conflictingFaucets.push(faucet);
                  }
                }
              }
              
              // Add delay between batches to be nice to the RPC
              if (i + batchSize < faucetAddresses.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
            
          } catch (fallbackError:any) {
            console.warn(`Fallback method also failed for factory ${factoryAddress}:`, fallbackError.message);
            continue;
          }
        }

      } catch (factoryError) {
        console.error(`Error checking factory ${factoryAddress}:`, factoryError);
        continue;
      }
    }

    // Return results
    if (conflictingFaucets.length > 0) {
      console.log(`Found ${conflictingFaucets.length} name conflicts across factories`);
      return {
        exists: true,
        existingFaucet: {
          address: conflictingFaucets[0].address,
          name: conflictingFaucets[0].name,
          owner: conflictingFaucets[0].owner
        },
        conflictingFaucets
      };
    }

    console.log(`Name "${proposedName}" is available across all factories on current network`);
    return { exists: false };
    
  } catch (error: any) {
    console.error("Error in checkFaucetNameExistsAcrossAllFactories:", error);
    // Don't throw, return graceful degradation
    return { 
      exists: false, 
      warning: "Name validation unavailable due to network issues. Please ensure your name is unique."
    };
  }
}

/**
 * Enhanced version of the original checkFaucetNameExists that checks all factories
 * This replaces the single factory check with a multi-factory check
 */
export async function checkFaucetNameExists(
  provider: BrowserProvider,
  network: Network, // Pass the whole network object instead of single factory address
  proposedName: string
): Promise<NameValidationResult & { 
  conflictingFaucets?: Array<{
    address: string
    name: string
    owner: string
    factoryAddress: string
    factoryType: FactoryType
  }>
}> {
  try {
    if (!proposedName.trim()) {
      throw new Error("Faucet name cannot be empty");
    }

    console.log(`Checking name "${proposedName}" across all factories on ${network.name}`);
    
    // Use the new function that checks all factories
    return await checkFaucetNameExistsAcrossAllFactories(
      provider, 
      network.factoryAddresses, 
      proposedName
    );
    
  } catch (error: any) {
    console.error("Error in enhanced name check:", error);
    return { 
      exists: false, 
      warning: "Unable to validate name due to network issues. Please ensure your name is unique."
    };
  }
}

/**
 * Get all faucet names from all factories on a single network (for comparison/statistics)
 */
export async function getAllFaucetNamesOnNetwork(
  provider: Provider,
  network: Network
): Promise<Array<{
  faucetAddress: string
  name: string
  owner: string
  factoryAddress: string
  factoryType: FactoryType
}>> {
  try {
    console.log(`Fetching all faucet names from ${network.name}...`);
    
    const allFaucetNames: any[] = [];

    // Process all factory addresses for this network
    for (const factoryAddress of network.factoryAddresses) {
      if (!isAddress(factoryAddress)) {
        console.warn(`Invalid factory address ${factoryAddress} on ${network.name}, skipping`);
        continue;
      }

      // Check if factory contract exists
      const code = await provider.getCode(factoryAddress);
      if (code === "0x") {
        console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`);
        continue;
      }

      // Detect factory type and get appropriate ABI
      let factoryType: FactoryType;
      let config: FactoryConfig;
      
      try {
        factoryType = await detectFactoryType(provider, factoryAddress);
        config = getFactoryConfig(factoryType);
        console.log(`Processing factory ${factoryAddress} (type: ${factoryType})`);
      } catch (error) {
        console.warn(`Could not detect factory type for ${factoryAddress}, skipping:`, error);
        continue;
      }

      const factoryContract = new Contract(factoryAddress, config.abi, provider);

      try {
        // Try to get all faucet details at once (more efficient)
        let faucetDetails: any[] = [];
        try {
          faucetDetails = await factoryContract.getAllFaucetDetails();
          console.log(`Got ${faucetDetails.length} faucet details from factory ${factoryAddress}`);
        } catch (getAllError:any) {
          console.warn(`getAllFaucetDetails failed for ${factoryAddress}, trying individual approach:`, getAllError.message);
          
          // Fallback: Get addresses and fetch names individually
          const faucetAddresses: string[] = await factoryContract.getAllFaucets();
          console.log(`Got ${faucetAddresses.length} faucet addresses from factory ${factoryAddress}`);
          
          // Process in batches to avoid overwhelming RPC
          const batchSize = 10;
          for (let i = 0; i < faucetAddresses.length; i += batchSize) {
            const batch = faucetAddresses.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (faucetAddress) => {
              try {
                if (!faucetAddress || faucetAddress === ZeroAddress) return null;
                
                const faucetType = factoryType as FaucetType;
                const faucetConfig = getFaucetConfig(faucetType);
                const faucetContract = new Contract(faucetAddress, faucetConfig.abi, provider);
                
                // Check if deleted
                const isDeleted = await faucetContract.deleted();
                if (isDeleted) return null;
                
                // Get basic details
                const [name, owner] = await Promise.all([
                  faucetContract.name(),
                  faucetContract.owner()
                ]);
                
                return {
                  faucetAddress,
                  name,
                  owner,
                  factoryAddress,
                  factoryType
                };
              } catch (error) {
                console.warn(`Error getting details for faucet ${faucetAddress}:`, error);
                return null;
              }
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            batchResults.forEach(result => {
              if (result.status === 'fulfilled' && result.value) {
                faucetDetails.push(result.value);
              }
            });
            
            // Add delay between batches
            if (i + batchSize < faucetAddresses.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }

        // Process the faucet details
        faucetDetails.forEach(detail => {
          if (detail && detail.faucetAddress && detail.name) {
            allFaucetNames.push({
              faucetAddress: detail.faucetAddress,
              name: detail.name,
              owner: detail.owner || "Unknown",
              factoryAddress,
              factoryType,
            });
          }
        });
        
      } catch (factoryError) {
        console.error(`Error fetching faucet names from factory ${factoryAddress} on ${network.name}:`, factoryError);
      }
    }
    
    console.log(`Found ${allFaucetNames.length} faucets total on ${network.name}`);
    return allFaucetNames;
    
  } catch (error) {
    console.error(`Error fetching faucet names for ${network.name}:`, error);
    return [];
  }
}



// Alternative: Enhanced createFaucet function that includes proper validation
// If you want to include validation in the createFaucet function, use this version instead:

export async function createFaucetWithValidation(
  provider: BrowserProvider,
  factoryAddress: string,
  name: string,
  tokenAddress: string,
  chainId: bigint,
  networkId: bigint,
  useBackend: boolean,
  isCustom: boolean = false,
  network: Network, // Add network parameter for validation
): Promise<string> {
  try {
    if (!name.trim()) {
      throw new Error("Faucet name cannot be empty");
    }
    if (!isAddress(tokenAddress)) {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }
    if (!isAddress(factoryAddress)) {
      throw new Error(`Invalid factory address: ${factoryAddress}`);
    }

    // Determine factory type and get appropriate config
    const factoryType = determineFactoryType(useBackend, isCustom)
    const config = getFactoryConfig(factoryType)

    console.log(`Creating faucet with factory type: ${factoryType}`)

    // Enhanced name validation with network object
    console.log("Validating faucet name before creation...");
    try {
      const nameCheck = await checkFaucetNameExists(provider, network, name);
      
      if (nameCheck.exists && nameCheck.existingFaucet) {
        const conflictDetails = nameCheck.conflictingFaucets 
          ? ` Conflicts found in: ${nameCheck.conflictingFaucets.map(c => `${c.factoryType} factory`).join(', ')}`
          : '';
        
        throw new Error(
          `A faucet with the name "${nameCheck.existingFaucet.name}" already exists on this network.${conflictDetails} ` +
          `Please choose a different name.`
        );
      }
      
      if (nameCheck.warning) {
        console.warn("Name validation warning:", nameCheck.warning);
        // Continue with creation but log the warning
      }
      
      console.log("Name validation passed");
    } catch (validationError: any) {
      if (validationError.message.includes("already exists")) {
        // Re-throw name conflict errors
        throw validationError;
      } else {
        // Log validation errors but don't block creation
        console.warn("Name validation failed, proceeding with creation:", validationError.message);
      }
    }

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const factoryContract = new Contract(factoryAddress, config.abi, signer);

    const backendAddress = VALID_BACKEND_ADDRESS;

    // Use the appropriate create function based on factory type
    const data = factoryContract.interface.encodeFunctionData(config.createFunction, [
      name,
      tokenAddress,
      backendAddress,
    ]);
    const dataWithReferral = appendDivviReferralData(data);

    const gasEstimate = await provider.estimateGas({
      to: factoryAddress,
      data: dataWithReferral,
      from: signerAddress,
    });
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    const maxFeePerGas = feeData.maxFeePerGas || undefined;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || undefined;
    const gasCost = gasEstimate * gasPrice;

    console.log("Create faucet params:", {
      factoryAddress,
      factoryType,
      createFunction: config.createFunction,
      name,
      tokenAddress,
      backendAddress,
      useBackend,
      isCustom,
      chainId: chainId.toString(),
      networkId: networkId.toString(),
      signerAddress,
      gasEstimate: gasEstimate.toString(),
      gasPrice: gasPrice.toString(),
      gasCost: gasCost.toString(),
    });

    const tx = await signer.sendTransaction({
      to: factoryAddress,
      data: dataWithReferral,
      gasLimit: (gasEstimate * BigInt(12)) / BigInt(10),
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }
    console.log("Transaction confirmed:", receipt.hash);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));

    const event = receipt?.logs
      ?.map((log) => {
        try {
          return factoryContract.interface.parseLog({ data: log.data, topics: log.topics as string[] });
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed?.name === "FaucetCreated");

    if (!event || !event.args || !event.args.faucet) {
      throw new Error("Failed to retrieve faucet address from transaction");
    }

    console.log("New faucet created:", {
      faucetAddress: event.args.faucet,
      factoryType,
      backendAddress,
      useBackend,
      isCustom,
    });

    return event.args.faucet as string;
  } catch (error: any) {
    console.error("Error creating faucet:", error);
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.");
    }
    if (error.data && typeof error.data === "string") {
      throw new Error(decodeRevertError(error.data));
    }
    throw new Error(error.reason || error.message || "Failed to create faucet");
  }
}

/**
 * Utility function to safely make contract calls with fallbacks
 */
export async function safeContractCall<T>(
  contract: Contract,
  methodName: string,
  args: any[] = [],
  fallbackValue: T
): Promise<T> {
  try {
    const result = await contract[methodName](...args);
    return result;
  } catch (error: any) {
    console.warn(`Contract call ${methodName} failed:`, error.message);
    return fallbackValue;
  }
}

/**
 * Check if a contract method exists
 */
export async function checkContractMethod(
  contract: Contract,
  methodName: string
): Promise<boolean> {
  try {
    const fragment = contract.interface.getFunction(methodName);
    return fragment !== null;
  } catch {
    return false;
  }
}

export async function getAllAdmins(
  provider: Provider,
  faucetAddress: string,
  faucetType?: FaucetType
): Promise<string[]> {
  try {
    if (!isAddress(faucetAddress)) {
      throw new Error("Invalid faucet address");
    }

    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)

    const faucetContract = new Contract(faucetAddress, config.abi, provider);
    const adminsResponse = await faucetContract.getAllAdmins();
    const admins = Array.isArray(adminsResponse)
      ? adminsResponse.flat().filter((admin: string) => isAddress(admin))
      : [];
    console.log(`Fetched admins for faucet ${faucetAddress}:`, admins);
    return admins;
  }  catch (error: any) {
    console.error(`Error fetching admins for ${faucetAddress}:`, error);
    throw new Error(error.message || "Failed to fetch admins");
  }
}

export async function isAdmin(
  provider: Provider,
  faucetAddress: string,
  userAddress: string,
  faucetType?: FaucetType
): Promise<boolean> {
  try {
    if (!isAddress(faucetAddress) || !isAddress(userAddress)) {
      throw new Error("Invalid faucet or user address");
    }

    const admins = await getAllAdmins(provider, faucetAddress, faucetType);
    const isAdminStatus = admins.some((admin: string) => admin.toLowerCase() === userAddress.toLowerCase());
    console.log(`Admin check for ${userAddress} on faucet ${faucetAddress}: ${isAdminStatus}`);
    return isAdminStatus;
  } catch (error: any) {
    console.error(`Error checking admin status for ${userAddress} on ${faucetAddress}:`, error);
    return false;
  }
}

// Check if an address is whitelisted for a faucet (only for droplist faucets)
export async function isWhitelisted(
  provider: Provider,
  faucetAddress: string,
  userAddress: string,
  faucetType?: FaucetType
): Promise<boolean> {
  try {
    if (!isAddress(faucetAddress) || !isAddress(userAddress)) {
      throw new Error("Invalid faucet or user address")
    }

    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    
    // Only droplist faucets have whitelist functionality
    if (detectedFaucetType !== 'droplist') {
      console.log(`Faucet ${faucetAddress} is not a droplist faucet, returning false for whitelist check`)
      return false
    }

    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, provider)
    const isWhitelisted = await faucetContract.isWhitelisted(userAddress)
    console.log(`Whitelist check for ${userAddress} on faucet ${faucetAddress}: ${isWhitelisted}`)
    return isWhitelisted
  } catch (error: any) {
    console.error(`Error checking whitelist for ${userAddress} on ${faucetAddress}:`, error)
    return false
  }
}

// Get faucet backend mode from contract
export async function getFaucetBackendMode(
  provider: Provider,
  faucetAddress: string,
  faucetType?: FaucetType
): Promise<boolean> {
  try {
    if (!isAddress(faucetAddress)) {
      throw new Error("Invalid faucet address");
    }

    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)

    const faucetContract = new Contract(faucetAddress, config.abi, provider);
    const useBackend = await faucetContract.getUseBackend();
    console.log(`Backend mode for faucet ${faucetAddress}: ${useBackend}`);
    return useBackend;
  } catch (error: any) {
    console.error(`Error fetching backend mode for ${faucetAddress}:`, error);
    return false; // Default to false if contract call fails
  }
}

// Get faucet details with admin check and backend mode from contract
export async function getFaucetDetails(
  provider: Provider, 
  faucetAddress: string,
  faucetType?: FaucetType
) {
  try {
    console.log(`Getting details for faucet ${faucetAddress}`);
    
    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    
    let contract: Contract;
    if ("getSigner" in provider && typeof provider.getSigner === "function") {
      try {
        contract = new Contract(faucetAddress, config.abi, await provider.getSigner());
      } catch (error) {
        console.warn(`Error getting signer, falling back to provider for ${faucetAddress}:`, error);
        contract = new Contract(faucetAddress, config.abi, provider);
      }
    } else {
      contract = new Contract(faucetAddress, config.abi, provider);
    }

    let tokenAddress = ZeroAddress;
    let ownerAddress = ZeroAddress;
    let faucetName = "Unknown Faucet";
    let claimAmount = BigInt(0);
    let startTime = BigInt(0);
    let endTime = BigInt(0);
    let isClaimActive = false;
    let balance = BigInt(0);
    let isEther = true;
    let tokenSymbol = "CELO";
    let tokenDecimals = 18;
    let useBackend = false;

    try {
      tokenAddress = await contract.token();
    } catch (error) {
      console.warn(`Error getting token address:`, error);
    }
    try {
      ownerAddress = await contract.owner();
    } catch (error) {
      console.warn(`Error getting owner address:`, error);
    }
    try {
      faucetName = await contract.name();
    } catch (error) {
      console.warn(`Error getting name:`, error);
    }
    try {
      // Handle different claim amount access patterns
      if (detectedFaucetType === 'custom') {
        // Custom faucets don't have a fixed claimAmount, will be handled per user
        claimAmount = BigInt(0);
      } else {
        claimAmount = await contract.claimAmount();
      }
    } catch (error) {
      console.warn(`Error getting claim amount:`, error);
    }
    try {
      startTime = await contract.startTime();
    } catch (error) {
      console.warn(`Error getting start time:`, error);
    }
    try {
      endTime = await contract.endTime();
    } catch (error) {
      console.warn(`Error getting end time:`, error);
    }
    try {
      isClaimActive = await contract.isClaimActive();
    } catch (error) {
      console.warn(`Error getting claim active status:`, error);
    }
    try {
      useBackend = await contract.getUseBackend();
    } catch (error) {
      console.warn(`Error getting backend mode:`, error);
    }
    try {
      const balanceResult = await contract.getFaucetBalance();
      balance = balanceResult[0];
      isEther = balanceResult[1];
      const network = await provider.getNetwork();
      tokenSymbol = isEther
        ? isCeloNetwork(network.chainId)
          ? "CELO"
          : network.chainId === BigInt(1135)
            ? "LISK"
            : network.chainId === BigInt(8453) || network.chainId === BigInt(84532)
              ? "ETH"
              : "ETH"
        : tokenSymbol;
    } catch (error) {
      console.warn(`Error getting balance:`, error);
      if (tokenAddress !== ZeroAddress) {
        try {
          const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
          balance = await tokenContract.balanceOf(faucetAddress);
          isEther = false;
        } catch (innerError) {
          console.warn(`Error getting token balance:`, innerError);
        }
      } else {
        try {
          balance = await provider.getBalance(faucetAddress);
          isEther = true;
        } catch (innerError) {
          console.warn(`Error getting native balance:`, innerError);
        }
      }
    }

    if (!isEther && tokenAddress !== ZeroAddress) {
      try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
        tokenSymbol = await tokenContract.symbol();
      } catch (error) {
        console.warn(`Error getting token symbol:`, error);
      }
      try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
        tokenDecimals = await tokenContract.decimals();
      } catch (error) {
        console.warn(`Error getting token decimals:`, error);
      }
    }

    let hasClaimed = false;
    let isUserAdmin = false;
    if ("getSigner" in provider && typeof provider.getSigner === "function") {
      try {
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();
        hasClaimed = await contract.hasClaimed(userAddress);
        isUserAdmin = await isAdmin(provider, faucetAddress, userAddress, detectedFaucetType);
      } catch (error) {
        console.warn(`Error checking claim status or admin status:`, error);
      }
    }

    console.log(`Successfully got details for faucet ${faucetAddress}`);
    return {
      faucetAddress,
      token: tokenAddress,
      owner: ownerAddress,
      name: faucetName,
      claimAmount,
      startTime,
      endTime,
      isClaimActive,
      balance,
      isEther,
      tokenSymbol,
      tokenDecimals,
      hasClaimed,
      isUserAdmin,
      backendMode: useBackend,
      faucetType: detectedFaucetType, // Include detected faucet type
    };
  } catch (error) {
    console.error(`Error getting faucet details for ${faucetAddress}:`, error);
    return {
      faucetAddress,
      token: ZeroAddress,
      owner: ZeroAddress,
      name: "Error Loading Faucet",
      claimAmount: BigInt(0),
      startTime: BigInt(0),
      endTime: BigInt(0),
      isClaimActive: false,
      balance: BigInt(0),
      isEther: true,
      tokenSymbol: "CELO",
      tokenDecimals: 18,
      hasClaimed: false,
      isUserAdmin: false,
      backendMode: false,
      faucetType: 'dropcode' as FaucetType, // Default type
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
export const getUserFaucets = async (userAddress: string) => {
  try {
    const response = await fetch(`https://identical-vivi-faucetdrops-41e9c56b.koyeb.app/user-faucets/${userAddress}`);
    
    if (!response.ok) {
        if(response.status === 404) return []; 
        throw new Error("Failed to fetch user faucets");
    }

    const data = await response.json();
    return data.faucets || []; 
  } catch (error) {
    console.error("Error fetching user faucets:", error);
    return [];
  }
};
// New helper function to fetch the blacklist
async function getDeletedFaucets(chainId: number): Promise<Set<string>> {
    try {
        // Adjust endpoint if necessary (e.g. /deleted-faucets or similar)
        const response = await fetch(`https://identical-vivi-faucetdrops-41e9c56b.koyeb.app/deleted-faucets?chainId=${chainId}`);
        
        if (!response.ok) {
            console.warn("Failed to fetch deleted faucets list");
            return new Set();
        }

        const data = await response.json();
        // Assuming backend returns { deletedAddresses: string[] } or just string[]
        // We use a Set for O(1) lookup performance during filtering
        const addresses = Array.isArray(data) ? data : (data.deletedAddresses || []);
        return new Set(addresses.map((a: string) => a.toLowerCase()));
    } catch (error) {
        console.error("Error fetching deleted faucets:", error);
        return new Set(); // Fail safe: return empty set so UI still loads
    }
}

export async function getFaucetsForNetwork(
    network: Network,
    provider: JsonRpcProvider | FallbackProvider
): Promise<FaucetMeta[]> {
    try {
        // 1. Start fetching the blacklist immediately (Non-blocking)
        // We assume network.chainId exists; if strictly typed, ensure it's available
        const deletedFaucetsPromise = getDeletedFaucets(Number(network.chainId));

        // 2. Start fetching faucets from all factory addresses in parallel (Existing logic)
        const resultsPromises = network.factoryAddresses.map(async (factoryAddress) => {
            if (!isAddress(factoryAddress)) return [];
            
            try {
                const factoryType = await detectFactoryType(provider, factoryAddress);
                const config = getFactoryConfig(factoryType);
                const factoryContract = new Contract(factoryAddress, config.abi, provider);
                const factoryCode = await provider.getCode(factoryAddress);
                if (factoryCode === "0x") return [];
                
                // Fetch all faucet addresses
                const faucetAddresses: string[] = await factoryContract.getAllFaucets();
                
                // Fetch details in parallel
                const metaPromises = faucetAddresses.map(async (addr) => {
                    if (!addr || addr === ZeroAddress) return null;
                    
                    const details = await getFaucetDetails(provider, addr, factoryType as FaucetType);
                    
                    return {
                        faucetAddress: details.faucetAddress,
                        isClaimActive: details.isClaimActive,
                        isEther: details.isEther,
                        createdAt: BigInt(details.startTime).toString(), 
                        tokenSymbol: details.tokenSymbol,
                        name: details.name,
                        owner: details.owner,
                        factoryAddress: factoryAddress,
                    } as FaucetMeta;
                });
                
                // Filter out nulls
                return (await Promise.all(metaPromises)).filter(m => m !== null) as FaucetMeta[];
            } catch (error) {
                console.error(`Error during lightweight fetch for factory ${factoryAddress}:`, error);
                return [];
            }
        });

        // 3. Await BOTH the blacklist and the blockchain results
        const [deletedFaucetsSet, allResults] = await Promise.all([
            deletedFaucetsPromise,
            Promise.all(resultsPromises)
        ]);

        let allFaucetsMeta = allResults.flat();
        
        // 4. Remove duplicates
        const uniqueFaucets = allFaucetsMeta.filter((faucet, index, self) =>
            index === self.findIndex((t) => (
                t.faucetAddress === faucet.faucetAddress
            ))
        );

        // 5. Final Filter: Remove faucets that are in the deleted set
        // We check against the Set we created in step 1
        const activeFaucets = uniqueFaucets.filter(faucet => 
            !deletedFaucetsSet.has(faucet.faucetAddress.toLowerCase())
        );

        return activeFaucets;

    } catch (error) {
        console.error(`Error in getFaucetsForNetwork (lightweight aggregation):`, error);
        return [];
    }
}

// Fetch transaction history for a specific faucet (admin only)
export async function getFaucetTransactionHistory(
  provider: BrowserProvider,
  faucetAddress: string,
  network: Network,
  faucetType?: FaucetType,
  signerAddress?: string  // Pass the connected wallet address from the caller
): Promise<{
  faucetAddress: string
  transactionType: string
  initiator: string
  amount: bigint
  isEther: boolean
  timestamp: number
}[]> {
  try {
    if (!isAddress(faucetAddress)) {
      throw new Error(`Invalid faucet address: ${faucetAddress}`)
    }

    // Get signer address - use passed address or try to get from provider
    let resolvedSignerAddress = signerAddress
    if (!resolvedSignerAddress) {
      try {
        const signer = await provider.getSigner()
        resolvedSignerAddress = await signer.getAddress()
      } catch (e) {
        throw new Error("Wallet not connected. Please connect your wallet to view transaction history.")
      }
    }

    const permissions = await checkPermissions(provider, faucetAddress, resolvedSignerAddress, faucetType)
    if (!permissions.isOwner && !permissions.isAdmin) {
      throw new Error("Only the owner or admin can view transaction history")
    }

    let transactions: any[] = []

    for (const factoryAddress of network.factoryAddresses) {
      if (!isAddress(factoryAddress)) {
        console.warn(`Invalid factory address ${factoryAddress} on ${network.name}, skipping`)
        continue
      }

      let factoryType: FactoryType
      let config: FactoryConfig

      try {
        factoryType = await detectFactoryType(provider, factoryAddress)
        config = getFactoryConfig(factoryType)
      } catch (error) {
        console.warn(`Could not detect factory type for ${factoryAddress}, skipping:`, error)
        continue
      }

      const code = await provider.getCode(factoryAddress)
      if (code === "0x") {
        console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`)
        continue
      }

      const factoryContract = new Contract(factoryAddress, config.abi, provider)

      try {
        const factoryTxs = await factoryContract.getFaucetTransactions(faucetAddress)
        transactions.push(...factoryTxs)
      } catch (error) {
        console.warn(`Error fetching transactions from factory ${factoryAddress}:`, error)
      }
    }

    const filteredTransactions = transactions
      .filter((tx: any) => tx.faucetAddress.toLowerCase() === faucetAddress.toLowerCase())
      .map((tx: any) => ({
        faucetAddress: tx.faucetAddress as string,
        transactionType: tx.transactionType as string,
        initiator: tx.initiator as string,
        amount: BigInt(tx.amount),
        isEther: tx.isEther as boolean,
        timestamp: Number(tx.timestamp),
      }))

    console.log(`Fetched ${filteredTransactions.length} transactions for faucet ${faucetAddress}`)
    return filteredTransactions

  } catch (error: any) {
    console.error(`Error fetching transaction history for faucet ${faucetAddress}:`, error)
    throw new Error(error.message || "Failed to fetch transaction history")
  }
}

async function contractExists(provider: JsonRpcProvider | FallbackProvider, address: string): Promise<boolean> {
  try {
    const code = await provider.getCode(address)
    return code !== "0x"
  } catch (error) {
    console.warn(`Error checking contract at ${address}:`, error)
    return false
  }
}

export async function getAllClaims(
  chainId: bigint,
  networks: Network[],
): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    const network = networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw new Error(`Network with chainId ${chainId} not found`)
    }

    const provider = getProviderForNetwork(network)
    const storageAddress = STORAGE_CONTRACT_ADDRESS
    const contract = new Contract(storageAddress, STORAGE_ABI, provider)

    // Verify contract exists
    const exists = await contractExists(provider, storageAddress)
    if (!exists) {
      console.error(`No contract at ${storageAddress} on ${network.name}`)
      return []
    }

    // Call getAllClaims function
    const claims: any[] = await contract.getAllClaims()

    // Fetch token details for each claim
    const formattedClaims = await Promise.all(
      claims.map(async (claim: any) => {
        let tokenSymbol = NATIVE_TOKEN_MAP[network.name] || "TOK"
        let tokenDecimals = 18
        let isEther = true

        // Check cache for faucet details
        const cacheKey = `${network.chainId}-${claim.faucet}`
        let faucetDetails = faucetDetailsCache.get(cacheKey)

        if (!faucetDetails) {
          try {
            faucetDetails = await getFaucetDetails(provider, claim.faucet)
            faucetDetailsCache.set(cacheKey, faucetDetails)
          } catch (error) {
            console.warn(`Error fetching faucet details for ${claim.faucet} on ${network.name}:`, error)
            faucetDetails = {
              tokenSymbol: NATIVE_TOKEN_MAP[network.name] || "TOK",
              tokenDecimals: 18,
              isEther: true,
            }
          }
        }

        tokenSymbol = faucetDetails.tokenSymbol
        tokenDecimals = faucetDetails.tokenDecimals
        isEther = faucetDetails.isEther

        return {
          claimer: claim.claimer as string,
          faucet: claim.faucet as string,
          amount: BigInt(claim.amount),
          txHash: claim.txHash as `0x${string}`,
          networkName: claim.networkName as string,
          timestamp: Number(claim.timestamp),
          tokenSymbol,
          tokenDecimals,
          isEther,
        }
      }),
    )

    return formattedClaims
  } catch (error) {
    console.error(`Error fetching claims for chainId ${chainId}:`, error)
    if (error instanceof Error) {
      throw new Error(`Failed to fetch claims: ${error.message}`)
    }
    throw new Error("Failed to fetch claims: Unknown error")
  }
}

export async function getAllClaimsFromFactoryTransactions(
  networks: Network[]
): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    chainId: bigint
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    const allClaims: any[] = []

    for (const network of networks) {
      try {
        const provider = getProviderForNetwork(network)
        
        // Iterate through all factory addresses for this network
        for (const factoryAddress of network.factoryAddresses) {
          if (!isAddress(factoryAddress)) {
            console.warn(`Invalid factory address ${factoryAddress} on ${network.name}, skipping`)
            continue
          }

          // Check if factory contract exists
          const code = await provider.getCode(factoryAddress)
          if (code === "0x") {
            console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`)
            continue
          }

          // Detect factory type and get appropriate ABI
          let factoryType: FactoryType;
          let config: FactoryConfig;
          
          try {
            factoryType = await detectFactoryType(provider, factoryAddress);
            config = getFactoryConfig(factoryType);
          } catch (error) {
            console.warn(`Could not detect factory type for ${factoryAddress}, skipping:`, error);
            continue;
          }

          const factoryContract = new Contract(factoryAddress, config.abi, provider)

          try {
            // Get all transactions from this factory
            const allTransactions = await factoryContract.getAllTransactions()
            console.log(`Found ${allTransactions.length} transactions from factory ${factoryAddress} on ${network.name}`)

            // Filter for claim transactions (assuming transaction type includes "claim" or similar)
            const claimTransactions = allTransactions.filter((tx: any) => 
              tx.transactionType && 
              (tx.transactionType.toLowerCase().includes('claim') || 
               tx.transactionType.toLowerCase().includes('drop'))
            )

            console.log(`Found ${claimTransactions.length} claim transactions from factory ${factoryAddress}`)

            // Process each claim transaction
            for (const tx of claimTransactions) {
              try {
                // Get faucet details to fetch token information
                let tokenSymbol = NATIVE_TOKEN_MAP[network.name] || "TOK"
                let tokenDecimals = 18
                let isEther = true

                // Check cache for faucet details
                const cacheKey = `${network.chainId}-${tx.faucetAddress}`
                let faucetDetails = faucetDetailsCache.get(cacheKey)

                if (!faucetDetails) {
                  try {
                    faucetDetails = await getFaucetDetails(provider, tx.faucetAddress)
                    faucetDetailsCache.set(cacheKey, faucetDetails)
                  } catch (error) {
                    console.warn(`Error fetching faucet details for ${tx.faucetAddress} on ${network.name}:`, error)
                    faucetDetails = {
                      tokenSymbol: NATIVE_TOKEN_MAP[network.name] || "TOK",
                      tokenDecimals: 18,
                      isEther: true,
                    }
                  }
                }

                tokenSymbol = faucetDetails.tokenSymbol
                tokenDecimals = faucetDetails.tokenDecimals
                isEther = faucetDetails.isEther

                // Create claim object from transaction data
                const claim = {
                  claimer: tx.initiator as string, // Assuming initiator is the claimer for claim transactions
                  faucet: tx.faucetAddress as string,
                  amount: BigInt(tx.amount),
                  txHash: tx.txHash as `0x${string}`, // Assuming txHash exists in transaction data
                  networkName: network.name,
                  timestamp: Number(tx.timestamp),
                  chainId: network.chainId,
                  tokenSymbol,
                  tokenDecimals,
                  isEther,
                }

                allClaims.push(claim)
              } catch (processingError) {
                console.warn(`Error processing claim transaction:`, processingError)
              }
            }
          } catch (factoryError) {
            console.error(`Error fetching transactions from factory ${factoryAddress} on ${network.name}:`, factoryError)
          }
        }
      } catch (networkError) {
        console.error(`Error processing network ${network.name}:`, networkError)
      }
    }

    return allClaims
  } catch (error) {
    console.error("Error fetching claims from factory transactions:", error)
    return []
  }
}

// Modified function to combine storage data with factory transaction data
export async function getAllClaimsForAllNetworks(networks: Network[]): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    chainId: bigint
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    console.log("Fetching claims from both storage and factory transactions...")
    
    // Fetch claims from storage contract (historical data)
    const storageClaims = await fetchStorageData()
    console.log(`Found ${storageClaims.length} claims from storage contract`)

    // Add chainId to storage claims (assuming they're all from Celo for now)
    const storageClaimsWithChainId = storageClaims.map(claim => ({
      ...claim,
      chainId: BigInt(42220), // Celo chainId - adjust if storage is on different network
    }))

    // Fetch claims from factory transactions (new method)
    const factoryClaims = await getAllClaimsFromFactoryTransactions(networks)
    console.log(`Found ${factoryClaims.length} claims from factory transactions`)

    // Combine both sources and remove duplicates based on txHash
    const allClaims = [...storageClaimsWithChainId, ...factoryClaims]
    
    // Remove duplicates based on txHash
    const uniqueClaims = allClaims.reduce((acc, current) => {
      const existing = acc.find(item => item.txHash === current.txHash)
      if (!existing) {
        acc.push(current)
      }
      return acc
    }, [] as typeof allClaims)

    // Sort by timestamp (most recent first)
    const sortedClaims = uniqueClaims.sort((a, b) => b.timestamp - a.timestamp)
    
    console.log(`Total unique claims: ${sortedClaims.length} (${storageClaims.length} from storage + ${factoryClaims.length} from factory - duplicates)`)
    
    return sortedClaims
  } catch (error) {
    console.error("Error fetching claims for all networks:", error)
    if (error instanceof Error) {
      throw new Error(`Failed to fetch claims for all networks: ${error.message}`)
    }
    throw new Error("Failed to fetch claims for all networks: Unknown error")
  }
}

// Optional: Add a function to get only new claims from factories (excluding storage)
export async function getNewClaimsFromFactories(networks: Network[]): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    chainId: bigint
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    const factoryClaims = await getAllClaimsFromFactoryTransactions(networks)
    const sortedClaims = factoryClaims.sort((a, b) => b.timestamp - a.timestamp)
    
    console.log(`Found ${sortedClaims.length} new claims from factory transactions`)
    return sortedClaims
  } catch (error) {
    console.error("Error fetching new claims from factories:", error)
    return []
  }
}

// Helper function to migrate storage claims to factory format if needed
export async function migrateStorageClaimsToFactory(): Promise<void> {
  try {
    console.log("Starting migration of storage claims...")
    
    // This would be implemented if you want to migrate old storage claims
    // to be tracked through factory transactions as well
    // Implementation depends on your specific migration strategy
    
    console.log("Migration completed")
  } catch (error) {
    console.error("Error during migration:", error)
  }
}

// Fund faucet


export async function retrieveSecretCode(faucetAddress: string): Promise<string> {
  if (!isAddress(faucetAddress)) {
    throw new Error(`Invalid faucet address: ${faucetAddress}`)
  }

  try {
    // Check localStorage first
    const cachedCode = getFromStorage(`secretCode_${faucetAddress}`)
    if (cachedCode && /^[A-Z0-9]{6}$/.test(cachedCode)) {
      console.log(`Retrieved Drop code for ${faucetAddress} from localStorage`)
      return cachedCode
    }

    // Fallback to backend if not found in localStorage
    const response = await fetch("https://identical-vivi-faucetdrops-41e9c56b.koyeb.app/retrieve-secret-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        faucetAddress: getAddress(faucetAddress), // Normalize address
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || "Failed to retrieve Drop code")
    }

    const result = await response.json()
    const secretCode = result.secretCode

    if (!secretCode || !/^[A-Z0-9]{6}$/.test(secretCode)) {
      throw new Error("Invalid Drop code format received from backend")
    }

    // Store the retrieved Drop code in localStorage for future use
    saveToStorage(`secretCode_${faucetAddress}`, secretCode)

    console.log(`Retrieved and stored Drop code for ${faucetAddress} from backend`)
    return secretCode
  } catch (error: any) {
    console.error("Error retrieving Drop code:", error)
    throw new Error(error.message || "Failed to retrieve Drop code")
  }
}

const ERROR_SIGNATURES = {
  OwnableUnauthorizedAccount: "0x118cdaa7", // keccak256("OwnableUnauthorizedAccount(address)")
  ContractPaused: "0xbec6425c", // keccak256("ContractPaused()")
  OnlyAdmin: "0x9b23d3d9", // keccak256("OnlyAdmin()")
  EmptyName: "0xe8930e56", // keccak256("EmptyName()")
  UnknownError: "0xab35696f", // Placeholder for new error
  NotWhitelisted: "0x55f33f14", // keccak256("NotWhitelisted()")
}

// Helper to decode revert data
function decodeRevertError(data: string): string {
  if (data.startsWith(ERROR_SIGNATURES.OwnableUnauthorizedAccount)) {
    return "Only the faucet owner can perform this action"
  } else if (data.startsWith(ERROR_SIGNATURES.ContractPaused)) {
    return "Faucet is paused and cannot be modified"
  } else if (data.startsWith(ERROR_SIGNATURES.OnlyAdmin)) {
    return "Only an admin can perform this action"
  } else if (data.startsWith(ERROR_SIGNATURES.EmptyName)) {
    return "Faucet name cannot be empty"
  } else if (data.startsWith(ERROR_SIGNATURES.NotWhitelisted)) {
    return "Only whitelisted addresses are supported"
  } else if (data.startsWith(ERROR_SIGNATURES.UnknownError)) {
    return "Permission denied or invalid state (verify contract ABI and state)"
  }
  return "Unknown contract error occurred"
}


async function deleteFaucetMetadata(faucetAddress: string, userAddress: string, chainId: number): Promise<void> {
    try {
        const response = await fetch("https://identical-vivi-faucetdrops-41e9c56b.koyeb.app/delete-faucet-metadata", { // Replace with your actual backend URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                faucetAddress,
                userAddress,
                chainId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.warn(`Failed to delete metadata from backend: ${errorData.detail || 'Unknown error'}`);
        } else {
            console.log(`✅ Faucet metadata successfully removed from backend for ${faucetAddress}`);
        }
    } catch (error) {
        console.error(`Error communicating with backend for metadata deletion:`, error);
    }
}

export async function createQuizReward(
  provider: BrowserProvider,
  factoryAddress: string,
  name: string,
  tokenAddress: string,
  claimWindowDuration: number, // seconds — e.g. 172800 for 48h, saved in your backend at quiz creation
): Promise<string> {
  const backendA = VALID_BACKEND_ADDRESS;
  const backendB = BACKUP_BACKEND_ADDRESS;

  // --- 1. Validation ---
  if (!isAddress(factoryAddress) || !isAddress(tokenAddress)) {
    throw new Error("Invalid factory or token address");
  }
  if (!isAddress(backendA) || !isAddress(backendB)) {
    throw new Error("Invalid backend address configuration");
  }
  if (!provider) {
    throw new Error("Provider is not available");
  }

  try {
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    const factory = new Contract(factoryAddress, QUIZ_FACTORY_ABI, signer);

    console.log("🚀 Deploying QuizReward via low-level tx:", {
      name,
      tokenAddress,
      backendA,
      backendB,
      claimWindowDuration,
      signerAddress,
    });

    // --- 2. Encode data ---
    const data = factory.interface.encodeFunctionData("createQuizReward", [
      name,
      tokenAddress,
      backendA,
      backendB,
      claimWindowDuration,
    ]);

    const dataWithReferral = appendDivviReferralData(data);

    // --- 3. Send transaction ---
    const tx = await signer.sendTransaction({
      to: factoryAddress,
      data: dataWithReferral,
    });

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction receipt is null");

    await reportTransactionToDivvi(
      tx.hash as `0x${string}`,
      Number(await provider.getNetwork().then(n => n.chainId))
    );

    // --- 4. Parse event ---
    let deployedAddress = "";
    const factoryInterface = new Interface(QUIZ_FACTORY_ABI);

    for (const log of receipt.logs) {
      try {
        const parsedLog = factoryInterface.parseLog(log as any);
        if (parsedLog?.name === "QuizRewardCreated") {
          deployedAddress = parsedLog.args[0]; // quizReward address (first arg in event)
          break;
        }
      } catch (e) {
        // ignore unrelated logs
      }
    }

    if (!deployedAddress) {
      throw new Error("Quiz reward deployed but QuizRewardCreated event not found");
    }

    console.log("✅ QuizReward created at:", deployedAddress);
    return deployedAddress;

  } catch (error: any) {
    console.error("❌ Quiz reward creation failed:", error);
    if (error.data && typeof error.data === "string") {
      throw new Error(decodeRevertError(error.data));
    }
    throw new Error(error.reason || error.message || "Failed to create quiz reward");
  }
}

export async function createQuestReward(
  provider: BrowserProvider,
  factoryAddress: string,
  name: string,
  tokenAddress: string,
  questEndTime: number,
  claimWindowHours: number,
): Promise<string> {
  const backendA = VALID_BACKEND_ADDRESS;
  //const backendB = BACKUP_BACKEND_ADDRESS;

  // --- 1. Validation ---
  if (!isAddress(factoryAddress) || !isAddress(tokenAddress)) {
    throw new Error("Invalid factory or token address");
  }
  if (!isAddress(backendA) ) {
    throw new Error("Invalid backend address configuration");
  }
  if (!provider) {
    throw new Error("Provider is not available");
  }

  try {
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    const factory = new Contract(factoryAddress, QUEST_FACTORY_ABI, signer);

    console.log("🚀 Deploying QuestReward via low-level tx:", {
      name,
      tokenAddress,
      backendA,
      questEndTime,
      claimWindowHours,
      signerAddress,
    });

    // --- 2. Encode data ---
    const data = factory.interface.encodeFunctionData("createQuestReward", [
      name,
      tokenAddress,
      backendA,
      questEndTime,
      claimWindowHours,
    ]);

    const dataWithReferral = appendDivviReferralData(data);

    // --- 3. Send transaction ---
    const tx = await signer.sendTransaction({
      to: factoryAddress,
      data: dataWithReferral,
    });

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction receipt is null");

    await reportTransactionToDivvi(
      tx.hash as `0x${string}`,
      Number(await provider.getNetwork().then(n => n.chainId))
    );

    // --- 4. Parse event ---
    let deployedAddress = "";
    const factoryInterface = new Interface(QUEST_FACTORY_ABI);

    for (const log of receipt.logs) {
      try {
        const parsedLog = factoryInterface.parseLog(log as any);
        if (parsedLog?.name === "QuestRewardCreated") {
          deployedAddress = parsedLog.args[0];
          break;
        }
      } catch (e) {
        // ignore unrelated logs
      }
    }

    if (!deployedAddress) {
      throw new Error("Quest deployed but QuestRewardCreated event not found");
    }

    console.log("✅ QuestReward created at:", deployedAddress);
    return deployedAddress;

  } catch (error: any) {
    console.error("❌ Quest creation failed:", error);
    if (error.data && typeof error.data === "string") {
      throw new Error(decodeRevertError(error.data));
    }
    throw new Error(error.reason || error.message || "Failed to create quest reward");
  }
}

export async function createFaucet(
  provider: BrowserProvider,
  factoryAddress: string,
  name: string,
  tokenAddress: string,
  chainId: bigint,
  networkId: bigint,
  useBackend: boolean,
  isCustom: boolean = false,
): Promise<string> {
  try {
    if (!name.trim()) {
      throw new Error("Faucet name cannot be empty");
    }
    if (!isAddress(tokenAddress)) {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }
    if (!isAddress(factoryAddress)) {
      throw new Error(`Invalid factory address: ${factoryAddress}`);
    }

    const factoryType = determineFactoryType(useBackend, isCustom)
    const config = getFactoryConfig(factoryType)

    console.log(`Creating faucet with factory type: ${factoryType}`)

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const factoryContract = new Contract(factoryAddress, config.abi, signer);

    const backendAddress = VALID_BACKEND_ADDRESS;

    const data = factoryContract.interface.encodeFunctionData(config.createFunction, [
      name,
      tokenAddress,
      backendAddress,
    ]);
    const dataWithReferral = appendDivviReferralData(data);

    console.log("Create faucet params:", {
      factoryAddress,
      factoryType,
      createFunction: config.createFunction,
      name,
      tokenAddress,
      backendAddress,
      useBackend,
      isCustom,
      chainId: chainId.toString(),
      networkId: networkId.toString(),
      signerAddress,
    });

    // Simplified transaction - let wallet handle gas
    const tx = await signer.sendTransaction({
      to: factoryAddress,
      data: dataWithReferral,
    });

    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }
    console.log("Transaction confirmed:", receipt.hash);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));

    const event = receipt?.logs
      ?.map((log) => {
        try {
          return factoryContract.interface.parseLog({ data: log.data, topics: log.topics as string[] });
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed?.name === "FaucetCreated");

    if (!event || !event.args || !event.args.faucet) {
      throw new Error("Failed to retrieve faucet address from transaction");
    }

    console.log("New faucet created:", {
      faucetAddress: event.args.faucet,
      factoryType,
      backendAddress,
      useBackend,
      isCustom,
    });

    return event.args.faucet as string;
  } catch (error: any) {
    console.error("Error creating faucet:", error);
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.");
    }
    if (error.data && typeof error.data === "string") {
      throw new Error(decodeRevertError(error.data));
    }
    throw new Error(error.reason || error.message || "Failed to create faucet");
  }
}

export async function fundFaucet(
  provider: BrowserProvider,
  faucetAddress: string,
  amount: bigint,
  isEther: boolean,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation")
  }
  
  try {
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()
    
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    
    const faucetContract = new Contract(faucetAddress, config.abi, signer)
    const isCelo = isCeloNetwork(chainId)
    
    console.log("Funding params:", {
      faucetAddress,
      amount: amount.toString(),
      isEther,
      chainId: chainId.toString(),
      networkId: networkId.toString(),
      signerAddress,
    })
    
    // Helper function to get gas parameters
    const getGasParams = async () => {
      try {
        const feeData = await provider.getFeeData()
        
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          // EIP-1559
          return {
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          }
        } else if (feeData.gasPrice) {
          // Legacy
          return {
            gasPrice: feeData.gasPrice,
          }
        }
        return {}
      } catch (error) {
        console.warn("Could not fetch fee data, using defaults:", error)
        return {}
      }
    }
    
    if (isEther && !isCelo) {
      console.log(`Funding faucet ${faucetAddress} with ${amount} native tokens on chain ${chainId}`)
      
      const gasParams = await getGasParams()
      const gasLimit = await provider.estimateGas({
        to: faucetAddress,
        from: signerAddress,
        value: amount,
        data: "0x",
      })
      
      const tx = await signer.sendTransaction({
        to: faucetAddress,
        value: amount,
        data: "0x",
        gasLimit: gasLimit,
        ...gasParams,
      })
      
      console.log("Transaction hash:", tx.hash)
      const receipt = await tx.wait()
      if (!receipt) {
        throw new Error("Fund transaction receipt is null")
      }
      console.log("Transaction confirmed:", receipt.hash)
      await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))
      return tx.hash
    }
    
    const tokenAddress =
      isEther && isCelo
        ? "0x471EcE3750Da237f93B8E339c536989b8978a438" // Wrapped CELO
        : await faucetContract.token()
    
    if (tokenAddress === ZeroAddress) {
      throw new Error("Token address is zero, cannot proceed with ERC-20 transfer")
    }
    
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)
    
    // Check current allowance first
    console.log("Checking current allowance...")
    const currentAllowance = await tokenContract.allowance(signerAddress, faucetAddress)
    
    if (currentAllowance >= amount) {
      console.log("Sufficient allowance already exists, skipping approve")
    } else {
      console.log(`Approving ${amount} ${isEther && isCelo ? "CELO" : "tokens"} for faucet ${faucetAddress}`)
      
      // Reset allowance to 0 if needed (some tokens require this)
      if (currentAllowance > 0n) {
        console.log("Resetting allowance to 0 first...")
        const resetData = tokenContract.interface.encodeFunctionData("approve", [faucetAddress, 0n])
        const resetDataWithReferral = appendDivviReferralData(resetData)
        
        const gasParams = await getGasParams()
        const resetGasLimit = await provider.estimateGas({
          to: tokenAddress,
          from: signerAddress,
          data: resetDataWithReferral,
        })
        
        const resetTx = await signer.sendTransaction({
          to: tokenAddress,
          data: resetDataWithReferral,
          gasLimit: resetGasLimit,
          ...gasParams,
        })
        
        const resetReceipt = await resetTx.wait()
        if (!resetReceipt) {
          throw new Error("Reset allowance transaction receipt is null")
        }
        console.log("Reset allowance confirmed:", resetReceipt.hash)
      }
      
      const approveData = tokenContract.interface.encodeFunctionData("approve", [faucetAddress, amount])
      const approveDataWithReferral = appendDivviReferralData(approveData)
      
      const gasParams = await getGasParams()
      const approveGasLimit = await provider.estimateGas({
        to: tokenAddress,
        from: signerAddress,
        data: approveDataWithReferral,
      })
      
      const approveTx = await signer.sendTransaction({
        to: tokenAddress,
        data: approveDataWithReferral,
        gasLimit: approveGasLimit,
        ...gasParams,
      })
      
      console.log("Approve transaction hash:", approveTx.hash)
      const approveReceipt = await approveTx.wait()
      if (!approveReceipt) {
        throw new Error("Approve transaction receipt is null")
      }
      console.log("Approve transaction confirmed:", approveReceipt.hash)
      await reportTransactionToDivvi(approveTx.hash as `0x${string}`, Number(chainId))
    }
    
    console.log(`Funding faucet ${faucetAddress} with ${amount} ${isEther && isCelo ? "CELO" : "tokens"}`)
    const fundData = faucetContract.interface.encodeFunctionData("fund", [amount])
    const fundDataWithReferral = appendDivviReferralData(fundData)
    
    const gasParams = await getGasParams()
    const fundGasLimit = await provider.estimateGas({
      to: faucetAddress,
      from: signerAddress,
      data: fundDataWithReferral,
    })
    
    const fundTx = await signer.sendTransaction({
      to: faucetAddress,
      data: fundDataWithReferral,
      gasLimit: fundGasLimit,
      ...gasParams,
    })
    
    console.log("Fund transaction hash:", fundTx.hash)
    const fundReceipt = await fundTx.wait()
    if (!fundReceipt) {
      throw new Error("Fund transaction receipt is null")
    }
    console.log("Fund transaction confirmed:", fundReceipt.hash)
    await reportTransactionToDivvi(fundTx.hash as `0x${string}`, Number(chainId))
    return fundTx.hash
    
  } catch (error: any) {
    console.error("Error funding faucet:", error)
    
    // Enhanced error handling
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.")
    }
    
    if (error.code === "INSUFFICIENT_FUNDS") {
      throw new Error("Insufficient funds to complete the transaction including gas fees.")
    }
    
    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction was rejected by user.")
    }
    
    if (error.message?.includes("RPC endpoint")) {
      throw new Error("RPC endpoint error. Please check your network connection and try again.")
    }
    
    // Extract useful error message
    const errorMessage = error.reason || error.message || "Failed to fund faucet"
    throw new Error(errorMessage)
  }
}
export async function withdrawTokens(
  provider: BrowserProvider,
  faucetAddress: string,
  amount: bigint,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation")
  }

  try {
    const signer = await provider.getSigner()
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer)

    const data = faucetContract.interface.encodeFunctionData("withdraw", [amount])
    const dataWithReferral = appendDivviReferralData(data)

    console.log("Withdraw tokens params:", {
      faucetAddress,
      amount: amount.toString(),
      chainId: chainId.toString(),
      networkId: networkId.toString(),
    })

    // Simplified transaction
    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
    })

    console.log("Withdraw transaction hash:", tx.hash)
    const receipt = await tx.wait()
    if (!receipt) {
      throw new Error("Withdraw transaction receipt is null")
    }
    console.log("Withdraw transaction confirmed:", receipt.hash)
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))

    return tx.hash
  } catch (error: any) {
    console.error("Error withdrawing tokens:", error)
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.")
    }
    throw new Error(error.reason || error.message || "Failed to withdraw tokens")
  }
}

export async function setWhitelistBatch(
  provider: BrowserProvider,
  faucetAddress: string,
  addresses: string[],
  status: boolean,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation")
  }

  try {
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    
    if (detectedFaucetType !== 'droplist') {
      throw new Error("Whitelist functionality is only available for droplist faucets")
    }

    const signer = await provider.getSigner()
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer)

    const data = faucetContract.interface.encodeFunctionData("setWhitelistBatch", [addresses, status])
    const dataWithReferral = appendDivviReferralData(data)

    console.log("Set whitelist batch params:", {
      faucetAddress,
      addresses,
      status,
      chainId: chainId.toString(),
      networkId: networkId.toString(),
    })

    // Simplified transaction
    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
    })

    console.log("Set whitelist batch transaction hash:", tx.hash)
    const receipt = await tx.wait()
    if (!receipt) {
      throw new Error("Set whitelist batch transaction receipt is null")
    }
    console.log("Set whitelist batch transaction confirmed:", receipt.hash)
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))

    return tx.hash
  } catch (error: any) {
    console.error("Error setting whitelist batch:", error)
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.")
    }
    throw new Error(error.reason || error.message || "Failed to set whitelist batch")
  }
}

export async function setCustomClaimAmountsBatch(
  provider: BrowserProvider,
  faucetAddress: string,
  users: string[],
  amounts: bigint[],
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation")
  }

  try {
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    
    if (detectedFaucetType !== 'custom') {
      throw new Error("Custom claim amounts are only available for custom faucets")
    }

    const signer = await provider.getSigner()
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer)

    const data = faucetContract.interface.encodeFunctionData("setCustomClaimAmountsBatch", [users, amounts])
    const dataWithReferral = appendDivviReferralData(data)

    console.log("Set custom claim amounts batch params:", {
      faucetAddress,
      users,
      amounts: amounts.map((a) => a.toString()),
      chainId: chainId.toString(),
      networkId: networkId.toString(),
    })

    // Simplified transaction
    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
    })

    console.log("Set custom claim amounts batch transaction hash:", tx.hash)
    const receipt = await tx.wait()
    if (!receipt) {
      throw new Error("Set custom claim amounts batch transaction receipt is null")
    }
    console.log("Set custom claim amounts batch transaction confirmed:", receipt.hash)
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))

    return tx.hash
  } catch (error: any) {
    console.error("Error setting custom claim amounts batch:", error)
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.")
    }
    throw new Error(error.reason || error.message || "Failed to set custom claim amounts batch")
  }
}

export async function resetAllClaims(
  provider: BrowserProvider,
  faucetAddress: string,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation");
  }

  try {
    const signer = await provider.getSigner();
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer);

    const data = faucetContract.interface.encodeFunctionData("resetAllClaimed", []);
    const dataWithReferral = appendDivviReferralData(data);

    console.log("Reset all claims params:", {
      faucetAddress,
      chainId: chainId.toString(),
      networkId: networkId.toString(),
    });

    // Simplified transaction
    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
    });

    console.log("Reset all claims transaction hash:", tx.hash);
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Reset all claims transaction receipt is null");
    }
    console.log("Reset all claims transaction confirmed:", receipt.hash);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));

    return tx.hash;
  } catch (error: any) {
    console.error("Error resetting all claims:", error);
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.");
    }
    throw new Error(error.reason || error.message || "Failed to reset all claims");
  }
}

export async function setClaimParameters(
  provider: BrowserProvider,
  faucetAddress: string,
  claimAmount: bigint,
  startTime: number,
  endTime: number,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation");
  }

  try {
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const permissions = await checkPermissions(provider, faucetAddress, signerAddress, faucetType);
    if (permissions.isPaused) {
      throw new Error("Faucet is paused and cannot be modified");
    }
    if (!permissions.isOwner && !permissions.isAdmin) {
      throw new Error("Only the owner or admin can set claim parameters");
    }

    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer);

    let data: string;
    if (detectedFaucetType === 'custom') {
      data = faucetContract.interface.encodeFunctionData("setClaimParameters", [startTime, endTime]);
    } else {
      data = faucetContract.interface.encodeFunctionData("setClaimParameters", [claimAmount, startTime, endTime]);
    }
    
    const dataWithReferral = appendDivviReferralData(data);

    console.log("Set claim parameters params:", {
      faucetAddress,
      faucetType: detectedFaucetType,
      claimAmount: detectedFaucetType === 'custom' ? 'N/A (custom amounts)' : claimAmount.toString(),
      startTime,
      endTime,
      chainId: chainId.toString(),
      networkId: networkId.toString(),
    });

    // Simplified transaction
    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
    });

    console.log("Set claim parameters transaction hash:", tx.hash);
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Set claim parameters transaction receipt is null");
    }
    console.log("Set claim parameters transaction confirmed:", receipt.hash);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));

    return tx.hash;
  } catch (error: any) {
    console.error("Error setting claim parameters:", error);
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.");
    }
    throw new Error(error.reason || error.message || "Failed to set claim parameters");
  }
}

export async function updateFaucetName(
  provider: BrowserProvider,
  faucet: string,
  name: string,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<`0x${string}`> {
  try {
    if (!checkNetwork(chainId, networkId)) {
      throw new Error("Switch to the correct network to perform this operation");
    }

    if (!name.trim()) {
      throw new Error("Faucet name cannot be empty");
    }

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const permissions = await checkPermissions(provider, faucet, signerAddress, faucetType);
    if (permissions.isPaused) {
      throw new Error("Faucet is paused and cannot be modified");
    }
    if (!permissions.isOwner && !permissions.isAdmin) {
      throw new Error("Only the owner or admin can update the faucet name");
    }

    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucet)
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucet, config.abi, signer);

    // Simplified transaction
    const tx = await faucetContract.updateName(name);

    console.log(`Update faucet name transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }

    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
    return tx.hash as `0x${string}`;
  } catch (error: any) {
    console.error("Error updating faucet name:", error);
    if (error.data && typeof error.data === "string") {
      throw new Error(decodeRevertError(error.data));
    }
    throw new Error(error.reason || error.message || "Failed to update faucet name");
  }
}

// Replace your existing deleteFaucet export function in faucet.ts with this version

export async function deleteFaucet(
    provider: BrowserProvider,
    faucetAddress: string,
    chainId: bigint,
    networkId: bigint,
    faucetType?: FaucetType
): Promise<`0x${string}`> {
    try {
        if (!checkNetwork(chainId, networkId)) {
            throw new Error("Switch to the correct network to perform this operation");
        }

        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        const permissions = await checkPermissions(provider, faucetAddress, signerAddress, faucetType);
        if (permissions.isPaused) {
            throw new Error("Faucet is paused and cannot be deleted");
        }
        // Note: The original code allowed admins to delete; ensure this is the desired permission level.
        if (!permissions.isOwner && !permissions.isAdmin) {
            throw new Error("Only the owner or admin can delete the faucet");
        }

        const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
        const config = getFaucetConfig(detectedFaucetType)
        const faucetContract = new Contract(faucetAddress, config.abi, signer);

        // Simplified transaction
        const tx = await faucetContract.deleteFaucet();

        console.log(`Delete faucet transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        if (!receipt) {
            throw new Error("Transaction receipt is null");
        }

        // --- NEW STEP: Call backend to record the deletion off-chain ---
        await deleteFaucetMetadata(
            faucetAddress,
            signerAddress, // Use the actual user who signed the transaction
            Number(chainId)
        );
        // --- END NEW STEP ---

        await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
        faucetDetailsCache.delete(faucetAddress);
        return tx.hash as `0x${string}`;
    } catch (error: any) {
        console.error("Error deleting faucet:", error);
        if (error.data && typeof error.data === "string") {
            throw new Error(decodeRevertError(error.data));
        }
        throw new Error(error.reason || error.message || "Failed to delete faucet");
    }
}



export async function addAdmin(
  provider: BrowserProvider,
  faucetAddress: string,
  adminAddress: string,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<`0x${string}`> {
  try {
    if (!checkNetwork(chainId, networkId)) {
      throw new Error("Switch to the correct network to perform this operation");
    }

    if (!isAddress(adminAddress)) {
      throw new Error("Invalid admin address");
    }

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const permissions = await checkPermissions(provider, faucetAddress, signerAddress, faucetType);
    if (permissions.isPaused) {
      throw new Error("Faucet is paused and cannot be modified");
    }
    if (!permissions.isOwner && !permissions.isAdmin) {
      throw new Error("Only the owner or admin can add an admin");
    }

    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer);
    
    const data = faucetContract.interface.encodeFunctionData("addAdmin", [adminAddress]);
    const dataWithReferral = appendDivviReferralData(data);

    // Simplified transaction
    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
    });

    console.log(`Add admin transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }

    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
    return tx.hash as `0x${string}`;
  } catch (error: any) {
    console.error("Error adding admin:", error);
    if (error.data && typeof error.data === "string") {
      throw new Error(decodeRevertError(error.data));
    }
    throw new Error(error.reason || error.message || "Failed to add admin");
  }
}

export async function removeAdmin(
  provider: BrowserProvider,
  faucetAddress: string,
  adminAddress: string,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<`0x${string}`> {
  try {
    if (!checkNetwork(chainId, networkId)) {
      throw new Error("Switch to the correct network to perform this operation");
    }

    if (!isAddress(adminAddress)) {
      throw new Error("Invalid admin address");
    }

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const permissions = await checkPermissions(provider, faucetAddress, signerAddress, faucetType);
    if (permissions.isPaused) {
      throw new Error("Faucet is paused and cannot be modified");
    }
    if (!permissions.isOwner && !permissions.isAdmin) {
      throw new Error("Only the owner or admin can remove an admin");
    }

    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer);
    
    const data = faucetContract.interface.encodeFunctionData("removeAdmin", [adminAddress]);
    const dataWithReferral = appendDivviReferralData(data, signerAddress as `0x${string}`);

    // Simplified transaction
    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
    });

    console.log(`Remove admin transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }

    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
    return tx.hash as `0x${string}`;
  } catch (error: any) {
    console.error("Error removing admin:", error);
    if (error.data && typeof error.data === "string") {
      throw new Error(decodeRevertError(error.data));
    }
    throw new Error(error.reason || error.message || "Failed to remove admin");
  }
}

export async function storeClaim(
  provider: BrowserProvider,
  claimer: string,
  faucetAddress: string,
  amount: bigint,
  txHash: string,
  chainId: number,
  networkId: number,
  networkName: string
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation");
  }

  try {
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const storageContract = new Contract(STORAGE_CONTRACT_ADDRESS, STORAGE_ABI, signer);

    // Convert txHash to bytes32 (ensure it's a valid 32-byte hash)
    const formattedTxHash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
    if (!/^0x[a-fA-F0-9]{64}$/.test(formattedTxHash)) {
      throw new Error(`Invalid transaction hash format: ${formattedTxHash}`);
    }

    if (!networkName) {
      throw new Error("Network name cannot be empty");
    }

    // Encode function data with parameters in the correct order as per ABI
    const data = storageContract.interface.encodeFunctionData("storeClaim", [
      claimer,
      formattedTxHash,
      amount,
      networkName,
      faucetAddress,
    ]);

    // Append Divvi referral data with additional validation
    const divviStatus = getDivviStatus();
    console.log("Divvi SDK status before appending referral:", divviStatus);
    const dataWithReferral = appendDivviReferralData(data, signerAddress as `0x${string}`);
    const referralTag = dataWithReferral.slice(data.length);
    console.log("Divvi referral data appended:", {
      originalDataLength: data.length,
      dataWithReferralLength: dataWithReferral.length,
      referralTag,
      referralTagValid: referralTag.startsWith('6decb85d'),
    });

    // Validate referral tag
    if (!referralTag.startsWith('6decb85d')) {
      console.warn("Generated referral tag does not have expected prefix '6decb85d'");
    }

    // Estimate gas
    const gasEstimate = await provider.estimateGas({
      to: STORAGE_CONTRACT_ADDRESS,
      data: dataWithReferral,
      from: signerAddress,
    });
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || undefined;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || undefined;

    console.log("Store claim params:", {
      claimer,
      faucetAddress,
      amount: amount.toString(),
      txHash: formattedTxHash,
      networkName,
      chainId,
      networkId,
      signerAddress,
      gasEstimate: gasEstimate.toString(),
      maxFeePerGas: maxFeePerGas?.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
      divviStatus,
    });

    const tx = await signer.sendTransaction({
      to: STORAGE_CONTRACT_ADDRESS,
      data: dataWithReferral,
      gasLimit: gasEstimate * BigInt(12) / BigInt(10), // 20% buffer
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    console.log("Store claim transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Store claim transaction confirmed:",);

    // Ensure transaction is mined before reporting to Divvi
    if (!receipt || !receipt.blockNumber) {
      throw new Error("Transaction receipt is null or not mined");
    }

    // Report the storeClaim transaction hash to Divvi
    if (isSupportedNetwork(chainId)) {
      console.log(`Reporting storeClaim transaction ${tx.hash} to Divvi`);
      await reportTransactionToDivvi(tx.hash as `0x${string}`, chainId);
    } else {
      console.warn(`Chain ID ${chainId} is not supported by Divvi, skipping transaction reporting`);
    }

    return tx.hash;
  } catch (error: any) {
    console.error("Error storing claim:", error);
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.");
    }
    if (error.message?.includes("Invalid Divvi referral data")) {
      throw new Error("Failed to append valid Divvi referral data. Please check Divvi SDK integration.");
    }
    if (error.message?.includes("Failed to report transaction to Divvi")) {
      throw new Error("Failed to report transaction to Divvi. Claim recorded, but referral tracking may be incomplete.");
    }
    throw new Error(error.reason || error.message || "Failed to store claim");
  }
}

export async function resetClaimedStatus(
  provider: BrowserProvider,
  faucetAddress: string,
  addresses: string[],
  status: boolean,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation")
  }

  try {
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    
    if (detectedFaucetType !== 'dropcode') {
      throw new Error("Reset claimed batch is only available for dropcode faucets")
    }

    const signer = await provider.getSigner()
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer)

    const data = faucetContract.interface.encodeFunctionData("resetClaimedBatch", [addresses])
    const dataWithReferral = appendDivviReferralData(data)

    console.log("Reset claimed status params:", {
      faucetAddress,
      addresses,
      status,
      chainId: chainId.toString(),
      networkId: networkId.toString(),
    })

    // Simplified transaction
    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
    })

    console.log("Reset claimed status transaction hash:", tx.hash)
    const receipt = await tx.wait()
    if (!receipt) {
      throw new Error("Reset claimed status transaction receipt is null")
    }
    console.log("Reset claimed status transaction confirmed:", receipt.hash)
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))

    return tx.hash
  } catch (error: any) {
    console.error("Error resetting claimed status:", error)
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.")
    }
    throw new Error(error.reason || error.message || "Failed to reset claimed status")
  }
}