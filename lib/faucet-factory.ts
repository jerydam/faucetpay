import { type BrowserProvider, Contract, ZeroAddress, JsonRpcProvider } from "ethers"
import { FACTORY_ABI } from "./abis"
import { getFaucetDetails } from "./faucet"
import type { Network } from "@/hooks/use-network"
import { appendDivviReferralData, reportTransactionToDivvi, isCeloNetwork } from "./divvi-integration"

// Function to check if a contract exists at the given address
async function contractExists(provider: JsonRpcProvider | BrowserProvider, address: string): Promise<boolean> {
  try {
    const code = await provider.getCode(address)
    return code !== "0x" // If code is not empty, contract exists
  } catch (error) {
    console.warn(`Error checking if contract exists at ${address}:`, error)
    return false
  }
}

// Function to check if an address is a valid faucet contract with more robust error handling
async function isValidFaucetContract(provider: JsonRpcProvider | BrowserProvider, address: string): Promise<boolean> {
  try {
    // First check if any contract exists at this address
    const exists = await contractExists(provider, address)
    if (!exists) {
      console.warn(`No contract exists at address ${address}`)
      return false
    }

    // Try to call a simple view function that should exist on all faucet contracts
    const contract = new Contract(
      address,
      [
        {
          inputs: [],
          name: "token",
          outputs: [{ internalType: "address", name: "", type: "address" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      provider,
    )

    // Add a timeout to prevent hanging
    const tokenPromise = contract.token()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Token call timed out for ${address}`)), 10000),
    )

    await Promise.race([tokenPromise, timeoutPromise])
    return true
  } catch (error) {
    console.warn(`Address ${address} is not a valid faucet contract:`, error)
    return false
  }
}

// Function to create a provider with timeout and retry
async function createProviderWithRetry(rpcUrl: string, retries = 2, timeout = 5000): Promise<JsonRpcProvider | null> {
  let lastError: Error | null = null

  for (let i = 0; i <= retries; i++) {
    try {
      const provider = new JsonRpcProvider(rpcUrl)

      // Test the provider with a simple call
      const blockNumber = await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("RPC request timeout")), timeout)),
      ])

      // If we get here, the provider is working
      console.log(`Successfully connected to ${rpcUrl}, current block: ${blockNumber}`)
      return provider
    } catch (error) {
      console.warn(`Attempt ${i + 1}/${retries + 1} failed for ${rpcUrl}:`, error)
      lastError = error as Error

      // Wait a bit before retrying (exponential backoff)
      if (i < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)))
      }
    }
  }

  console.error(`Failed to connect to ${rpcUrl} after ${retries + 1} attempts. Last error:`, lastError)
  return null
}

// Create a dedicated provider for a specific network
function createNetworkProvider(network: Network): JsonRpcProvider {
  return new JsonRpcProvider(network.rpcUrl)
}

// Function to get faucets from a specific network
export async function getFaucetsFromNetwork(network: Network, userProvider?: BrowserProvider) {
  console.log(`Fetching faucets from ${network.name}...`)
  try {
    // Always create a dedicated provider for this network to avoid network switching issues
    const provider = createNetworkProvider(network)

    console.log(`Created dedicated provider for ${network.name}`)

    try {
      // Test the provider with a simple call and longer timeout
      try {
        const blockNumberPromise = provider.getBlockNumber()
        const blockNumber = await Promise.race([
          blockNumberPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`RPC request timeout for ${network.name}`)), 15000),
          ),
        ])
        console.log(`Successfully connected to ${network.name}, current block: ${blockNumber}`)
      } catch (error) {
        console.warn(`Provider test failed for ${network.name}:`, error)
        // Continue anyway - we'll return an empty array if we can't get faucets
      }

      try {
        // First check if the factory contract exists at the specified address
        const factoryExists = await contractExists(provider, network.factoryAddress)
        if (!factoryExists) {
          console.warn(`Factory contract does not exist at ${network.factoryAddress} on ${network.name}`)
          return []
        }

        console.log(`Creating factory contract for ${network.name} at ${network.factoryAddress}`)
        const factoryContract = new Contract(network.factoryAddress, FACTORY_ABI, provider)

        // Get all faucet addresses with increased timeout
        let faucetAddresses: string[] = []
        try {
          console.log(`Getting all faucets from ${network.name}...`)

          // Special handling for Arbitrum
          if (network.chainId === 42161) {
            console.log("Using alternative method for Arbitrum")
            // For Arbitrum, try a different approach since getAllFaucets is failing
            try {
              // Try to get faucets one by one
              const addresses = []
              let index = 0
              let hasMore = true

              while (hasMore && index < 100) {
                // Limit to 100 to prevent infinite loops
                try {
                  const faucetPromise = factoryContract.faucets(index)
                  const faucet = await Promise.race([
                    faucetPromise,
                    new Promise<string>((_, reject) =>
                      setTimeout(() => reject(new Error(`faucets(${index}) timed out`)), 10000),
                    ),
                  ])

                  if (faucet && faucet !== ZeroAddress) {
                    addresses.push(faucet)
                    console.log(`Found faucet at index ${index}: ${faucet}`)
                  } else {
                    console.log(`No more faucets after index ${index}`)
                    hasMore = false
                  }

                  index++
                } catch (e) {
                  console.warn(`Error getting faucet at index ${index}:`, e)
                  hasMore = false
                }
              }

              if (addresses.length > 0) {
                faucetAddresses = addresses
                console.log(`Found ${addresses.length} faucets on Arbitrum using alternative method`)
              } else {
                console.log("No faucets found on Arbitrum using alternative method")
              }
            } catch (fallbackError) {
              console.error(`Fallback method also failed for Arbitrum:`, fallbackError)
            }
          } else {
            // For other networks, try the standard approach
            try {
              // First try getAllFaucets
              const getAllFaucetsPromise = factoryContract.getAllFaucets()
              faucetAddresses = await Promise.race([
                getAllFaucetsPromise,
                new Promise<string[]>((_, reject) =>
                  setTimeout(() => reject(new Error(`getAllFaucets timed out for ${network.name}`)), 30000),
                ),
              ])
              console.log(`Found ${faucetAddresses.length} faucets on ${network.name} using getAllFaucets`)
            } catch (error) {
              console.warn(`getAllFaucets failed for ${network.name}, trying alternative method:`, error)

              // If getAllFaucets fails, try to get the count and iterate
              try {
                // This is a fallback approach if the contract doesn't have getAllFaucets
                // or if it's reverting for some reason
                const addresses = []
                let index = 0
                let hasMore = true

                while (hasMore && index < 100) {
                  // Limit to 100 to prevent infinite loops
                  try {
                    const faucetPromise = factoryContract.faucets(index)
                    const faucet = await Promise.race([
                      faucetPromise,
                      new Promise<string>((_, reject) =>
                        setTimeout(() => reject(new Error(`faucets(${index}) timed out`)), 10000),
                      ),
                    ])

                    if (faucet && faucet !== ZeroAddress) {
                      addresses.push(faucet)
                      console.log(`Found faucet at index ${index}: ${faucet}`)
                    } else {
                      console.log(`No more faucets after index ${index}`)
                      hasMore = false
                    }

                    index++
                  } catch (e) {
                    console.warn(`Error getting faucet at index ${index}:`, e)
                    hasMore = false
                  }
                }

                if (addresses.length > 0) {
                  faucetAddresses = addresses
                  console.log(`Found ${addresses.length} faucets on ${network.name} using alternative method`)
                } else {
                  console.log(`No faucets found on ${network.name} using alternative method`)
                }
              } catch (fallbackError) {
                console.error(`Fallback method also failed for ${network.name}:`, fallbackError)
              }
            }
          }

          console.log(`Found ${faucetAddresses.length} faucet addresses on ${network.name}`)
        } catch (error) {
          console.error(`Error getting faucet addresses from ${network.name}:`, error)
          return [] // Return empty array if we can't get the faucet addresses
        }

        if (faucetAddresses.length === 0) {
          console.log(`No faucets found on ${network.name}`)
          return []
        }

        // Filter out invalid faucet contracts and get details for each valid faucet
        // Process in batches to avoid overwhelming the provider
        const batchSize = 3 // Smaller batch size
        const results = []

        for (let i = 0; i < faucetAddresses.length; i += batchSize) {
          const batch = faucetAddresses.slice(i, i + batchSize)
          console.log(
            `Processing batch ${i / batchSize + 1} of ${Math.ceil(faucetAddresses.length / batchSize)} for ${
              network.name
            }`,
          )

          const batchPromises = batch.map(async (address: string) => {
            try {
              console.log(`Getting details for faucet ${address} on ${network.name}`)
              // Skip validation to improve performance and avoid timeouts
              // Use the dedicated network provider to avoid network switching issues
              const details = await getFaucetDetails(provider, address)
              return {
                ...details,
                network: {
                  chainId: network.chainId,
                  name: network.name,
                  color: network.color,
                  blockExplorerUrls: network.blockExplorerUrls,
                },
              }
            } catch (error) {
              console.warn(`Error getting details for faucet ${address} on ${network.name}:`, error)
              return null
            }
          })

          try {
            // Add timeout to the entire batch
            const batchResultsPromise = Promise.all(batchPromises)
            const batchResults = await Promise.race([
              batchResultsPromise,
              new Promise<any[]>((_, reject) =>
                setTimeout(() => reject(new Error(`Batch processing timed out for ${network.name}`)), 30000),
              ),
            ])

            results.push(...batchResults.filter((result) => result !== null))
          } catch (error) {
            console.error(`Error processing batch for ${network.name}:`, error)
            // Continue with next batch
          }
        }

        console.log(`Successfully processed ${results.length} faucets from ${network.name}`)
        return results
      } catch (error) {
        console.error(`Error interacting with ${network.name} contracts:`, error)
        return []
      }
    } catch (error) {
      console.error(`Error getting faucets from ${network.name}:`, error)
      return []
    }
  } catch (error) {
    console.error(`Error getting faucets from ${network.name}:`, error)
    return []
  }
}

// Helper function to check if the provider is on the correct network
async function isCorrectNetwork(provider: BrowserProvider, chainId: number): Promise<boolean> {
  try {
    const network = await provider.getNetwork()
    return Number(network.chainId) === chainId
  } catch (error) {
    console.error("Error checking network:", error)
    return false
  }
}

// Function to get faucets specifically for Lisk network
async function getLiskFaucets(network: Network) {
  console.log(`Getting faucets specifically for Lisk network (${network.chainId})...`)

  try {
    // Create a dedicated provider for Lisk
    const provider = new JsonRpcProvider(network.rpcUrl)

    // Test the provider
    try {
      const blockNumber = await provider.getBlockNumber()
      console.log(`Successfully connected to Lisk, current block: ${blockNumber}`)
    } catch (error) {
      console.error(`Error connecting to Lisk RPC:`, error)
      return []
    }

    // Create factory contract
    const factoryContract = new Contract(network.factoryAddress, FACTORY_ABI, provider)

    // Try to get faucets one by one
    const addresses = []
    let index = 0
    let hasMore = true

    while (hasMore && index < 100) {
      try {
        const faucet = await factoryContract.faucets(index)

        if (faucet && faucet !== ZeroAddress) {
          addresses.push(faucet)
          console.log(`Found Lisk faucet at index ${index}: ${faucet}`)
        } else {
          console.log(`No more Lisk faucets after index ${index}`)
          hasMore = false
        }

        index++
      } catch (e) {
        console.warn(`Error getting Lisk faucet at index ${index}:`, e)
        hasMore = false
      }
    }

    if (addresses.length === 0) {
      console.log(`No faucets found on Lisk`)
      return []
    }

    // Get details for each faucet
    const results = []

    for (const address of addresses) {
      try {
        const details = await getFaucetDetails(provider, address)
        results.push({
          ...details,
          network: {
            chainId: network.chainId,
            name: network.name,
            color: network.color,
            blockExplorerUrls: network.blockExplorerUrls,
          },
        })
      } catch (error) {
        console.warn(`Error getting details for Lisk faucet ${address}:`, error)
      }
    }

    console.log(`Successfully processed ${results.length} faucets from Lisk`)
    return results
  } catch (error) {
    console.error(`Error getting faucets from Lisk:`, error)
    return []
  }
}

// New function to get faucets from all networks
export async function getAllNetworksFaucets(networks: Network[], userProvider?: BrowserProvider, userChainId?: number) {
  console.log(`Getting faucets from all ${networks.length} networks...`)

  // Process each network independently with its own try/catch
  const networkPromises = networks.map(async (network) => {
    try {
      console.log(`Starting to fetch faucets from ${network.name}...`)

      // Special handling for Lisk
      if (network.chainId === 4202) {
        return await getLiskFaucets(network)
      }

      // For other networks, use the standard approach
      const faucets = await getFaucetsFromNetwork(network)
      console.log(`Completed fetching ${faucets.length} faucets from ${network.name}`)
      return faucets
    } catch (error) {
      console.error(`Failed to get faucets from ${network.name}:`, error)
      return [] // Return empty array on error
    }
  })

  // Wait for all promises to resolve, even if some fail
  const results = await Promise.allSettled(networkPromises)

  // Process results, using empty arrays for rejected promises
  const allFaucets = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))

  console.log(`Total faucets fetched from all networks: ${allFaucets.length}`)
  return allFaucets
}

// Keep the existing functions for backward compatibility
export async function getAllFaucets(provider: BrowserProvider, factoryAddress: string) {
  try {
    const factoryContract = new Contract(factoryAddress, FACTORY_ABI, await provider.getSigner())

    // Get all faucet addresses
    const faucetAddresses = await factoryContract.getAllFaucets()

    // Get details for each faucet
    const faucetDetailsPromises = faucetAddresses.map(async (address: string) => {
      try {
        // Check if this is a valid faucet contract first
        const isValid = await isValidFaucetContract(provider, address)
        if (!isValid) {
          return null
        }
        return await getFaucetDetails(provider, address)
      } catch (error) {
        console.warn(`Error getting details for faucet ${address}:`, error)
        return null
      }
    })

    const results = await Promise.all(faucetDetailsPromises)
    return results.filter((result) => result !== null)
  } catch (error) {
    console.error("Error getting all faucets:", error)
    throw error
  }
}

// Update the createFaucet function to send the caller's address as the owner and handle network changes better
export async function createFaucet(
  provider: BrowserProvider,
  factoryAddress: string,
  name: string,
  tokenAddress: string,
  backendAddress: string = ZeroAddress,
) {
  try {
    console.log("Creating faucet with params:", {
      factoryAddress,
      name,
      tokenAddress,
      backendAddress,
    })

    // Get the current network to ensure we're on the right one
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)
    console.log(`Current network chainId: ${chainId}`)

    const signer = await provider.getSigner()
    const userAddress = await signer.getAddress()
    console.log(`Creating faucet as user: ${userAddress}`)

    const factoryContract = new Contract(factoryAddress, FACTORY_ABI, signer)
    const isCelo = isCeloNetwork(chainId)

    // Create new faucet with the required parameters
    console.log("Sending transaction to create faucet...")

    let tx
    if (isCelo) {
      // For Celo, append Divvi referral data
      console.log("Appending Divvi referral data for Celo transaction")

      // Get the transaction data without sending it
      const data = factoryContract.interface.encodeFunctionData("createFaucet", [name, tokenAddress, backendAddress])

      // Append Divvi referral data
      const dataWithReferral = appendDivviReferralData(data)

      // Send the transaction with the modified data
      tx = await signer.sendTransaction({
        to: factoryAddress,
        data: dataWithReferral,
      })
    } else {
      // For non-Celo networks, proceed normally
      tx = await factoryContract.createFaucet(name, tokenAddress, backendAddress)
    }

    // Wait for the transaction to be mined
    console.log(`Transaction sent: ${tx.hash}`)
    const receipt = await tx.wait()
    console.log(`Transaction confirmed: ${receipt.hash}`)

    // Report the transaction to Divvi if on Celo
    if (isCelo) {
      await reportTransactionToDivvi(tx.hash, chainId)
    }

    // Get the created faucet address from events
    // More robust event parsing
    let faucetAddress = null

    for (const log of receipt.logs) {
      try {
        const parsedLog = factoryContract.interface.parseLog(log)
        if (parsedLog && parsedLog.name === "FaucetCreated") {
          faucetAddress = parsedLog.args.faucet
          console.log(`Found FaucetCreated event with faucet address: ${faucetAddress}`)
          break
        }
      } catch (e) {
        // Skip logs that can't be parsed
        continue
      }
    }

    if (!faucetAddress) {
      // If we couldn't find the event, try an alternative approach
      console.log("Could not find FaucetCreated event, trying alternative approach...")

      // Try to get the last created faucet
      const allFaucets = await factoryContract.getAllFaucets()
      if (allFaucets && allFaucets.length > 0) {
        faucetAddress = allFaucets[allFaucets.length - 1]
        console.log(`Using last faucet from getAllFaucets: ${faucetAddress}`)
      } else {
        throw new Error("Failed to get created faucet address")
      }
    }

    return faucetAddress
  } catch (error: any) {
    // Check if this is a network change error
    if (error.message && error.message.includes("network changed")) {
      console.error("Network changed during transaction:", error)
      throw new Error("Network changed during transaction. Please try again with a stable network connection.")
    }

    console.error("Error creating faucet:", error)
    throw error
  }
}
