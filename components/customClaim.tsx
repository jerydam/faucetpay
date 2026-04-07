"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  FileUp, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  Trash2, 
  Upload,
  FileText,
  TableIcon,
  Copy,
  X,
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import { toast } from 'sonner'
import { parseUnits, formatUnits } from 'ethers'

interface ParsedEntry {
  address: string
  amount: string
  amountBigInt: bigint
  isValid: boolean
  error?: string
}

interface CustomClaimUploaderProps {
  tokenSymbol: string
  tokenDecimals: number
  onDataParsed: (addresses: string[], amounts: bigint[]) => void
  onCancel?: () => void
}

export function CustomClaimUploader({ 
  tokenSymbol, 
  tokenDecimals, 
  onDataParsed,
  onCancel 
}: CustomClaimUploaderProps) {
  
  
  // State management
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedEntry[]>([])
  const [manualInput, setManualInput] = useState('')
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload')
  const [showPreview, setShowPreview] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [extractedText, setExtractedText] = useState('')
  const [showExtractedText, setShowExtractedText] = useState(false)
  const [showConversionHelp, setShowConversionHelp] = useState(false)

  // Statistics
  const validEntries = parsedData.filter(e => e.isValid)
  const invalidEntries = parsedData.filter(e => !e.isValid)
  const totalAmount = validEntries.reduce((sum, entry) => sum + entry.amountBigInt, BigInt(0))

  // ============= VALIDATION FUNCTION =============

  const validateEntry = (address: string, amountStr: string, lineNumber: number): ParsedEntry => {
    let isValid = true
    let error = ''

    // Clean inputs
    address = address.trim()
    amountStr = amountStr.trim()

    // Validate address format
    if (!address.startsWith('0x')) {
      isValid = false
      error = `Line ${lineNumber}: Address must start with 0x`
    } else if (address.length !== 42) {
      isValid = false
      error = `Line ${lineNumber}: Address must be 42 characters (got ${address.length})`
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      isValid = false
      error = `Line ${lineNumber}: Address contains invalid characters`
    }

    // Validate and parse amount
    let amountBigInt = BigInt(0)
    try {
      const amount = parseFloat(amountStr)
      
      if (isNaN(amount)) {
        isValid = false
        error = error || `Line ${lineNumber}: Amount is not a number (got "${amountStr}")`
      } else if (amount <= 0) {
        isValid = false
        error = error || `Line ${lineNumber}: Amount must be greater than 0 (got ${amount})`
      } else if (amount > 1000000000) {
        isValid = false
        error = error || `Line ${lineNumber}: Amount seems too large (${amount}), please verify`
      } else {
        try {
          amountBigInt = parseUnits(amount.toString(), tokenDecimals)
        } catch (e: any) {
          isValid = false
          error = error || `Line ${lineNumber}: Could not convert amount to token units: ${e.message}`
        }
      }
    } catch (e: any) {
      isValid = false
      error = error || `Line ${lineNumber}: Error parsing amount: ${e.message}`
    }

    return {
      address,
      amount: amountStr,
      amountBigInt,
      isValid,
      error: isValid ? undefined : error
    }
  }

  // ============= TEXT EXTRACTION HELPERS =============

  const extractFromLine = (line: string, lineNumber: number): ParsedEntry | null => {
    // Regex patterns
    const addressRegex = /0x[a-fA-F0-9]{40}/
    const amountRegex = /\d+\.?\d*/g
    
    const addressMatch = line.match(addressRegex)
    if (!addressMatch) return null
    
    const address = addressMatch[0]
    
    // Look for amount after the address
    const afterAddress = line.substring(line.indexOf(address) + address.length)
    const amounts = afterAddress.match(amountRegex)
    
    if (!amounts || amounts.length === 0) {
      // Try looking before the address
      const beforeAddress = line.substring(0, line.indexOf(address))
      const amountsBefore = beforeAddress.match(amountRegex)
      if (amountsBefore && amountsBefore.length > 0) {
        return validateEntry(address, amountsBefore[amountsBefore.length - 1], lineNumber)
      }
      return null
    }
    
    // Use the first amount found
    return validateEntry(address, amounts[0], lineNumber)
  }

  const extractFromGlobal = (text: string): ParsedEntry[] => {
    const entries: ParsedEntry[] = []
    
    // Find all addresses
    const addressRegex = /0x[a-fA-F0-9]{40}/g
    const addresses: string[] = []
    let match
    
    while ((match = addressRegex.exec(text)) !== null) {
      addresses.push(match[0])
    }
    
    if (debugMode) console.log(`Found ${addresses.length} addresses`)
    
    // Find all amounts (numbers)
    const amountRegex = /\b\d+\.?\d*\b/g
    const amounts: string[] = []
    
    while ((match = amountRegex.exec(text)) !== null) {
      const num = parseFloat(match[0])
      // Filter out obviously wrong numbers (like years, etc)
      if (num > 0 && num < 1000000000) {
        amounts.push(match[0])
      }
    }
    
    if (debugMode) console.log(`Found ${amounts.length} potential amounts`)
    
    // Try to pair them up
    const pairCount = Math.min(addresses.length, amounts.length)
    for (let i = 0; i < pairCount; i++) {
      const entry = validateEntry(addresses[i], amounts[i], i + 1)
      entries.push(entry)
    }
    
    return entries
  }

  // ============= FILE PARSING FUNCTIONS =============

  // Parse CSV files
  const parseCSV = (text: string): ParsedEntry[] => {
    const entries: ParsedEntry[] = []
    const lines = text.split('\n').filter(line => line.trim())
    
    let startIndex = 0
    // Skip header row if it exists
    if (lines[0] && (
      lines[0].toLowerCase().includes('address') || 
      lines[0].toLowerCase().includes('wallet') ||
      lines[0].toLowerCase().includes('amount')
    )) {
      startIndex = 1
      if (debugMode) console.log('⏭️ Skipping CSV header:', lines[0])
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Try different delimiters
      const delimiters = [',', '\t', ';', '|']
      let parts: string[] = []
      
      for (const delimiter of delimiters) {
        const testParts = line.split(delimiter).map(s => s.trim().replace(/"/g, ''))
        if (testParts.length >= 2) {
          parts = testParts
          break
        }
      }

      if (parts.length >= 2) {
        const address = parts[0]
        const amountStr = parts[1]
        
        const entry = validateEntry(address, amountStr, i + 1)
        entries.push(entry)
      }
    }

    if (debugMode) console.log(`✅ CSV parsed: ${entries.length} entries`)
    return entries
  }

  // Parse TXT files with enhanced extraction
  const parseTXT = (text: string): ParsedEntry[] => {
    const entries: ParsedEntry[] = []
    
    // Clean up the text first
    const cleanText = text
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, ' ') // Remove control chars except \n, \r, \t
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    if (debugMode) {
      console.log('🔍 Parsing text length:', cleanText.length)
      console.log('🔍 Text preview:', cleanText.substring(0, 200))
    }
    
    // Strategy 1: Try to find address-amount pairs with context
    const pairPattern = /(0x[a-fA-F0-9]{40})[^\d]*?(\d+(?:\.\d+)?)/g
    let match
    let lineNumber = 1
    
    while ((match = pairPattern.exec(cleanText)) !== null) {
      const address = match[1]
      const amount = match[2]
      
      if (debugMode) console.log(`Found pair: ${address} -> ${amount}`)
      
      const entry = validateEntry(address, amount, lineNumber)
      entries.push(entry)
      lineNumber++
    }
    
    // Strategy 2: If strategy 1 didn't work, try line-by-line
    if (entries.length === 0) {
      if (debugMode) console.log('🔄 No pairs found with pattern, trying line-by-line...')
      const lines = cleanText.split(/[\n\r]+/)
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        // Skip headers
        if (/address|wallet|amount|total|summary/i.test(line)) {
          if (debugMode) console.log('⏭️ Skipping header:', line)
          continue
        }
        
        const entry = extractFromLine(line, i + 1)
        if (entry) {
          entries.push(entry)
        }
      }
    }
    
    // Strategy 3: If still nothing, try global extraction
    if (entries.length === 0) {
      if (debugMode) console.log('🔄 Trying global extraction...')
      const globalEntries = extractFromGlobal(cleanText)
      entries.push(...globalEntries)
    }
    
    if (debugMode) {
      console.log(`✅ Total extracted entries: ${entries.length}`)
      console.log(`✅ Valid entries: ${entries.filter(e => e.isValid).length}`)
      console.log(`❌ Invalid entries: ${entries.filter(e => !e.isValid).length}`)
    }
    
    return entries
  }

  // Parse PDF files using pdfjs-dist (browser-compatible)
  const parsePDF = async (file: File): Promise<ParsedEntry[]> => {
    try {
      toast.success("Processing PDF, extracting text from PDF file...")
      
      // Try CDN-based parsing first
      try {
        const entries = await parsePDFWithCDN(file)
        if (entries.length > 0) {
          return entries
        }
        console.log('⚠️ CDN parsing returned no entries, trying basic extraction...')
      } catch (cdnError) {
        console.warn('⚠️ CDN parsing failed, trying basic extraction:', cdnError)
      }
      
      // Fallback to basic extraction
      return await parsePDFBasic(file)
      
    } catch (error: any) {
      console.error('❌ All PDF parsing methods failed:', error)
      
      toast.error("Failed to extract text from PDF. Please ensure the PDF contains selectable text.")
      
      return []
    }
  }

  // CDN-based parsing
  const parsePDFWithCDN = async (file: File): Promise<ParsedEntry[]> => {
    const pdfjsLib = await loadPdfJs()
    
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    
    console.log(`📄 PDF loaded with CDN: ${pdf.numPages} pages`)
    
    let fullText = ''
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      
      fullText += pageText + '\n'
    }
    
    setExtractedText(fullText)
    
    const entries = parseTXT(fullText)
    
    toast.success("PDF processed - Extracted text from PDF")
    
    return entries
  }

  // Basic extraction fallback
  const parsePDFBasic = async (file: File): Promise<ParsedEntry[]> => {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    let pdfText = ''
    for (let i = 0; i < uint8Array.length; i++) {
      pdfText += String.fromCharCode(uint8Array[i])
    }
    
    const extractedTexts: string[] = []
    
    // Extract using various patterns
    const patterns = [
      /BT([\s\S]*?)ET/g,  // Text objects
      /\(((?:[^()\\]|\\[()\\])*)\)/g,  // Parentheses strings
      /<([0-9a-fA-F]+)>/g  // Hex strings
    ]
    
    patterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(pdfText)) !== null) {
        const text = match[1]
        if (text && text.trim().length > 0) {
          extractedTexts.push(text)
        }
      }
    })
    
    const combinedText = extractedTexts
      .join(' ')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    setExtractedText(combinedText)
    
    if (!combinedText || combinedText.length < 20) {
      throw new Error('Could not extract meaningful text from PDF')
    }
    
    const entries = parseTXT(combinedText)
    
    toast.success("PDF processed - Extracted text from PDF")
    
    return entries
  }

  // Helper to load PDF.js from CDN
  const loadPdfJs = async () => {
    if ((window as any).pdfjsLib) {
      return (window as any).pdfjsLib
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.async = true
      
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib
        
        if (!pdfjsLib) {
          reject(new Error('Failed to load PDF.js'))
          return
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        
        resolve(pdfjsLib)
      }
      
      script.onerror = () => reject(new Error('Failed to load PDF.js script'))
      
      document.head.appendChild(script)
    })
  }

  // Parse XLSX/Excel files
  const parseXLSX = async (file: File): Promise<ParsedEntry[]> => {
    try {
      // Dynamically import xlsx library
      const XLSX = await import('xlsx')
      
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      // Get first sheet
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      
      const entries: ParsedEntry[] = []
      
      // Skip header row if it exists
      let startIndex = 0
      if (jsonData[0] && jsonData[0].some((cell: any) => 
        String(cell).toLowerCase().includes('address') || 
        String(cell).toLowerCase().includes('amount')
      )) {
        startIndex = 1
        if (debugMode) console.log('⏭️ Skipping Excel header')
      }

      for (let i = startIndex; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length < 2) continue

        const address = String(row[0]).trim()
        const amount = String(row[1]).trim()
        
        if (address && amount) {
          const entry = validateEntry(address, amount, i + 1)
          entries.push(entry)
        }
      }

      if (debugMode) console.log(`✅ Excel parsed: ${entries.length} entries`)
      return entries
    } catch (error) {
      toast.error("Failed to parse Excel file. Please ensure it's a valid XLSX or XLS file.")
      return []
    }
  }

  // ============= FILE HANDLING =============

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    const fileName = selectedFile.name.toLowerCase()
    const validExtensions = ['.csv', '.txt', '.pdf', '.xlsx', '.xls']
    const isValidFile = validExtensions.some(ext => fileName.endsWith(ext))

    if (!isValidFile) {
      toast.error("Invalid file type. Please upload a CSV, TXT, PDF, or Excel file.")
      return
    }

    setFile(selectedFile)
    await processFile(selectedFile)
  }

  const processFile = async (file: File) => {
    setIsProcessing(true)
    
    try {
      let entries: ParsedEntry[] = []
      const fileName = file.name.toLowerCase()

      if (debugMode) {
        console.log('📁 Processing file:', fileName)
        console.log('📊 File size:', file.size, 'bytes')
      }

      if (fileName.endsWith('.csv')) {
        const text = await file.text()
        if (debugMode) console.log('📄 CSV content preview:', text.substring(0, 500))
        entries = parseCSV(text)
      } else if (fileName.endsWith('.txt')) {
        const text = await file.text()
        if (debugMode) console.log('📄 TXT content preview:', text.substring(0, 500))
        entries = parseTXT(text)
      } else if (fileName.endsWith('.pdf')) {
        if (debugMode) console.log('📄 Parsing PDF...')
        entries = await parsePDF(file)
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        if (debugMode) console.log('📄 Parsing Excel...')
        entries = await parseXLSX(file)
      }

      if (debugMode) {
        console.log('✅ Parsed entries:', entries)
        console.log(`📊 Valid: ${entries.filter(e => e.isValid).length}, Invalid: ${entries.filter(e => !e.isValid).length}`)
      }

      setParsedData(entries)
      setShowPreview(true)

      toast.success(`File processed: ${entries.filter(e => e.isValid).length} valid entries found`)
    } catch (error: any) {
      console.error('❌ Processing error:', error)
      toast.error("Error processing file. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualInput = () => {
    if (!manualInput.trim()) {
      toast.warning("Please enter some data to process.")
      return
    }

    setIsProcessing(true)
    
    try {
      // Try to detect format and parse
      const entries = manualInput.includes(',') ? parseCSV(manualInput) : parseTXT(manualInput)
      
      setParsedData(entries)
      setShowPreview(true)

      toast.success(`Manual input processed: ${entries.filter(e => e.isValid).length} valid entries found`)
    } catch (error: any) {
      toast.error("Error processing manual input. Please check the format and try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // ============= DATA MANAGEMENT =============

  const handleRemoveEntry = (index: number) => {
    setParsedData(prev => prev.filter((_, i) => i !== index))
  }

  const handleConfirm = () => {
    if (validEntries.length === 0) {
      toast.warning("No valid entries to confirm.")
      return
    }

    const addresses = validEntries.map(e => e.address)
    const amounts = validEntries.map(e => e.amountBigInt)

    onDataParsed(addresses, amounts)
  }

  const handleReset = () => {
    setFile(null)
    setParsedData([])
    setManualInput('')
    setShowPreview(false)
    setExtractedText('')
    setShowExtractedText(false)
  }

  const handleExportTemplate = () => {
    const template = `address,amount
0x742d35Cc6634C0532925a3b844Bc454e4438f44e,100
0x5B38Da6a701c568545dCfcB03FcB875f56beddC4,250
0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2,500`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'custom_claims_template.csv'
    a.click()
    URL.revokeObjectURL(url)

    toast.success("Template downloaded")
  }

  const handleCopyInvalidEntries = () => {
    const invalidText = invalidEntries
      .map(e => `${e.address},${e.amount} - ${e.error}`)
      .join('\n')
    
    navigator.clipboard.writeText(invalidText)
    toast.warning("Invalid entries copied to clipboard")
  }

  // ============= RENDER =============

  return (
    <Card className="w-full max-w-full overflow-hidden">
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-6">
        <div className="space-y-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl">Upload Custom Claim Amounts</CardTitle>
            <CardDescription className="text-sm mt-2">
              Upload a file or manually enter addresses and amounts for custom claims
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-6">
        {!showPreview ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'manual')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-auto mb-4">
              <TabsTrigger value="upload" className="min-h-[44px] text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Upload File</span>
                <span className="xs:hidden">Upload</span>
              </TabsTrigger>
              <TabsTrigger value="manual" className="min-h-[44px] text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Manual Entry</span>
                <span className="xs:hidden">Manual</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-3 sm:space-y-4 mt-4">
              {/* PDF Tips Alert */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">PDF Upload Tips</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-xs">For best results with PDF files:</p>
                  <ul className="text-xs list-disc list-inside space-y-1 pl-2">
                    <li>Ensure addresses are in format: 0x followed by 40 characters</li>
                    <li>Amounts should be numbers (e.g., 100, 250.5)</li>
                    <li>Keep address and amount close together on same line</li>
                  </ul>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-xs"
                    onClick={() => setShowConversionHelp(true)}
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Having trouble with PDFs?
                  </Button>
                </AlertDescription>
              </Alert>

              <div className="border-2 border-dashed rounded-lg p-6 sm:p-8 text-center space-y-3 sm:space-y-4 touch-manipulation active:scale-[0.99] transition-transform">
                <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                
                <div>
                  <Label htmlFor="file-upload" className="cursor-pointer touch-manipulation">
                    <span className="text-sm font-medium">Click to upload</span>
                    <span className="text-xs sm:text-sm text-muted-foreground block sm:inline"> or drag and drop</span>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.txt,.pdf,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  CSV, TXT, PDF, XLSX, or XLS<span className="hidden sm:inline"> (MAX. 10MB)</span>
                </p>

                {file && (
                  <Alert>
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <AlertTitle className="text-sm">File Selected</AlertTitle>
                    <AlertDescription className="text-xs break-all">
                      <span className="font-medium">{file.name}</span>
                      <span className="text-muted-foreground ml-1">({(file.size / 1024).toFixed(2)} KB)</span>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">Supported Formats</AlertTitle>
                <AlertDescription className="space-y-2 text-xs">
                  <p><strong>CSV/XLSX:</strong> address,amount (one per line)</p>
                  <p><strong>TXT:</strong> address amount (space or comma separated)</p>
                  <p><strong>PDF:</strong> Text will be extracted automatically</p>
                  <p className="text-xs text-muted-foreground break-all">
                    Example: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e,100
                  </p>
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="manual" className="space-y-3 sm:space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="manual-input" className="text-sm">Enter Addresses and Amounts</Label>
                <Textarea
                  id="manual-input"
                  placeholder="Enter one address and amount per line:&#10;0x742d35Cc6634C0532925a3b844Bc454e4438f44e,100&#10;0x5B38Da6a701c568545dCfcB03FcB875f56beddC4,250&#10;&#10;Formats supported:&#10;- address,amount&#10;- address amount&#10;- address|amount"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  rows={8}
                  className="font-mono text-xs resize-none min-h-[200px] sm:min-h-0"
                />
              </div>

              <Button
                onClick={handleManualInput}
                disabled={isProcessing || !manualInput.trim()}
                className="w-full min-h-[44px]"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <TableIcon className="h-4 w-4 mr-2" />
                    Parse Input
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Card>
                <CardContent className="pt-4 sm:pt-6">
                  <div className="text-xl sm:text-2xl font-bold text-green-600">
                    {validEntries.length}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Valid Entries</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4 sm:pt-6">
                  <div className="text-xl sm:text-2xl font-bold text-red-600">
                    {invalidEntries.length}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Invalid Entries</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4 sm:pt-6">
                  <div className="text-xl sm:text-2xl font-bold truncate" title={formatUnits(totalAmount, tokenDecimals)}>
                    {formatUnits(totalAmount, tokenDecimals)}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Total {tokenSymbol}</p>
                </CardContent>
              </Card>
            </div>

            {/* Extracted Text Debug View */}
            {extractedText && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExtractedText(!showExtractedText)}
                  className="text-xs min-h-[36px]"
                >
                  {showExtractedText ? <EyeOff className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />}
                  <span className="hidden sm:inline">{showExtractedText ? 'Hide' : 'Show'} Extracted Text</span>
                  <span className="sm:hidden">{showExtractedText ? 'Hide' : 'Show'} Text</span>
                </Button>
              </div>
            )}

            {showExtractedText && extractedText && (
              <Alert>
                <AlertTitle className="text-sm">Extracted Text from PDF</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="h-[150px] sm:h-[200px] w-full rounded border p-2 mt-2">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {extractedText}
                    </pre>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs min-h-[36px] w-full sm:w-auto"
                    onClick={() => {
                      navigator.clipboard.writeText(extractedText)
                      toast.success("Copied to clipboard")
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Text
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Alerts */}
            {invalidEntries.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">Invalid Entries Found</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs">{invalidEntries.length} entries have errors and will be skipped</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyInvalidEntries}
                    className="text-xs min-h-[36px] w-full sm:w-auto"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Errors
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {validEntries.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-sm">Ready to Upload</AlertTitle>
                <AlertDescription className="text-xs">
                  {validEntries.length} valid entries will be processed
                </AlertDescription>
              </Alert>
            )}

            {/* Data Preview */}
            <div className="border rounded-lg">
              <div className="p-3 sm:p-4 border-b flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-sm sm:text-base">Data Preview</h3>
                <Badge variant="outline" className="text-xs whitespace-nowrap">
                  {parsedData.length} total
                </Badge>
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Amount ({tokenSymbol})</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.map((entry, index) => (
                        <TableRow key={index} className={!entry.isValid ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          <TableCell className="font-mono text-xs">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate" title={entry.address}>
                            {entry.address}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {entry.amount}
                          </TableCell>
                          <TableCell>
                            {entry.isValid ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 whitespace-nowrap">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Valid
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 whitespace-nowrap">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Invalid
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEntry(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Mobile Card View */}
              <ScrollArea className="h-[350px] sm:h-[400px] md:hidden">
                <div className="p-3 space-y-3">
                  {parsedData.map((entry, index) => (
                    <Card key={index} className={!entry.isValid ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800' : ''}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                #{index + 1}
                              </Badge>
                              {entry.isValid ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 text-xs whitespace-nowrap">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Valid
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 text-xs whitespace-nowrap">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Invalid
                                </Badge>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Address</p>
                                <p className="font-mono text-xs break-all leading-relaxed">{entry.address}</p>
                              </div>
                              
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                                <p className="text-sm font-medium">{entry.amount} {tokenSymbol}</p>
                              </div>
                              
                              {!entry.isValid && entry.error && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Error</p>
                                  <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{entry.error}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveEntry(index)}
                            className="min-h-[40px] min-w-[40px] p-2 flex-shrink-0 touch-manipulation"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1 min-h-[44px]"
              >
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>
              
              {onCancel && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1 min-h-[44px]"
                >
                  Cancel
                </Button>
              )}
              
              <Button
                onClick={handleConfirm}
                disabled={validEntries.length === 0}
                className="flex-1 min-h-[44px]"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Upload {validEntries.length} Entries</span>
                <span className="sm:hidden">Upload ({validEntries.length})</span>
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Conversion Help Dialog */}
      <Dialog open={showConversionHelp} onOpenChange={setShowConversionHelp}>
        <DialogContent className="max-w-[95vw] sm:max-w-[525px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl pr-8">How to Convert PDF Data</DialogTitle>
            <DialogDescription className="text-sm">
              Follow these steps to extract data from your PDF:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm sm:text-base">Method 1: Copy & Paste</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm pl-1">
                <li>Open your PDF file</li>
                <li>Select all text (Ctrl+A or Cmd+A)</li>
                <li>Copy the text (Ctrl+C or Cmd+C)</li>
                <li>Switch to "Manual Entry" tab</li>
                <li>Paste the text (Ctrl+V or Cmd+V)</li>
                <li>Click "Parse Input"</li>
              </ol>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-sm sm:text-base">Method 2: Convert to CSV</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm pl-1">
                <li>Use an online PDF to CSV converter</li>
                <li>Download the CSV file</li>
                <li>Upload the CSV file here</li>
              </ol>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-sm sm:text-base">Method 3: Use Excel</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm pl-1">
                <li>Copy data from PDF</li>
                <li>Paste into Excel/Google Sheets</li>
                <li>Save as CSV or XLSX</li>
                <li>Upload the file here</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}