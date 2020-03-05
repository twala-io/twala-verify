const {Command, flags} = require('@oclif/command')
const {pathToHash} = require('file-to-hash')
const {MerkleTree} = require('merkletreejs')
const sha256 = require('crypto-js/sha256')
const FileStream = require('fs')
const {cli} = require('cli-ux')
const Web3 = require('web3')

class TwalaCliCommand extends Command {
  async run() {
    const web3Provider = await cli.prompt('Node Provider (url)')
    const web3 = new Web3(web3Provider)
    const proofPath = await cli.prompt('Proof File (path)')
    const documentPath = await cli.prompt('Document File (path)')
    this.log()
    cli.action.start('generating proof hash')
    await cli.wait(3000)
    const initialProofHash = await pathToHash('sha256', proofPath)
    const proofHash = web3.utils.keccak256(initialProofHash)
    cli.action.stop()
    cli.action.start('generating document hash')
    await cli.wait(3000)
    const initialDocumentHash = await pathToHash('sha256', documentPath)
    const documentHash = web3.utils.keccak256(initialDocumentHash)
    cli.action.stop()
    cli.action.start('processing smart contracts')
    await cli.wait(3000)
    const proofHolderContractAbi = [{constant: true, inputs: [{name: '_hash', type: 'bytes32'}], name: 'retrieveProof', outputs: [{name: '', type: 'bytes32'}, {name: '', type: 'string'}, {name: '', type: 'string'}], payable: false, stateMutability: 'view', type: 'function'}, {constant: false, inputs: [{name: '_hash', type: 'bytes32'}, {name: '_root', type: 'string'}, {name: '_timestamp', type: 'string'}], name: 'recordProof', outputs: [], payable: false, stateMutability: 'nonpayable', type: 'function'}]
    const proofHolderContractAddress = '0xBc0DE9c1e18918aEE53C4CD54bf319CF09577D2c'
    const proofHolderContract = new web3.eth.Contract(proofHolderContractAbi, proofHolderContractAddress)
    cli.action.stop()
    cli.action.start('searching Ethereum network')
    const proofHolderProof = await proofHolderContract.methods.retrieveProof(proofHash).call()
    const proof = {
      hash: proofHolderProof[0],
      root: proofHolderProof[1],
      timestamp: proofHolderProof[2],
    }
    cli.action.stop()
    cli.action.start('building merkle tree')
    await cli.wait(5000)
    const proofContent = await FileStream.readFileSync(proofPath, 'utf-8')
    const proofContentArray = JSON.parse(web3.utils.hexToAscii(proofContent))
    const merkleLeaves = proofContentArray.map(merkleLeaf => sha256(JSON.stringify(merkleLeaf)))
    const merkleTree = new MerkleTree(merkleLeaves, sha256)
    const merkleRoot = merkleTree.getRoot().toString('hex')
    cli.action.stop()
    this.log()
    if (proofHash === proof.hash) {
      this.log(`Proof Hash: ${proofHash}`)
      this.log(`Proof Timestamp: ${proof.timestamp}`)
      if (merkleRoot === proof.root) {
        this.log(`Merkle Root: ${merkleRoot}`)
        for (let proofContent of proofContentArray) {
          if (proofContent.hash === documentHash) {
            this.log(`Document Hash: ${proofContent.hash}`)
            this.log(`Document Timestamp: ${proofContent.timestamp}`)
          } else {
            this.log('document invalid')
          }
        }
      } else {
        this.log('merkle root invalid')
      }
    } else {
      this.log('proof invalid')
    }
  }
}

TwalaCliCommand.description = `Command-line interface for attesting Twala documents
Attest the legitimacy of a Twala document directly from the Main Ethereum network
`

TwalaCliCommand.flags = {
  version: flags.version({char: 'v'}),
  help: flags.help({char: 'h'}),
}

module.exports = TwalaCliCommand
