const {
  Contract,
  JsonRpcProvider,
  Wallet,
  WebSocketProvider,
} = require("ethers");
const ESCROW_ABI = require("./abi.json");

const main = async () => {
  try {
    console.log("\n\nStarting event listener ... ");

    const escrowContract = new Contract(
      process.env.ESCROW_CONTRACT_ADDRESS,
      ESCROW_ABI,
      new WebSocketProvider(process.env.WSS_URL)
    );

    await escrowContract.on("*", async (log) => {
      console.log("log ", log);

      const eventData = log.args[0];

      const eventName = log.fragment.name;

      console.log("event name ", eventName);

      const escrowSigner = new Wallet(
        process.env.ADMIN_PRIVATE_KEY,
        new JsonRpcProvider(process.env.HTTP_URL)
      );

      if (eventName == "ProposalAccepted") {
        const escrowContract = new Contract(
          process.env.ESCROW_CONTRACT_ADDRESS,
          ESCROW_ABI,
          escrowSigner
        );

        const proposalId = parseInt(eventData[0]);

        await escrowContract
          .swap(proposalId, {
            maxPriorityFeePerGas: 10e9,
            maxFeePerGas: 15e9,
          })
          .then((resp) => {
            console.log("resp ", resp);
          });
      } else if (eventName == "Swapped") {
        console.log("Event data ", eventData);

        // A swap has been completed, send the NFTs to their new respective parties
        const proposerNFTContractAddress = eventData[3][0];
        const proposeeNFTContractAddress = eventData[4][0];
        const proposerNFTTokenId = eventData[3][1];
        const proposeeNFTTokenId = eventData[4][1];
        const proposer = eventData[1];
        const proposee = eventData[2];

        console.log(
          "proposerNFT ",
          proposerNFTContractAddress,
          proposerNFTTokenId
        );
        console.log(
          "proposeeNFT ",
          proposeeNFTContractAddress,
          proposeeNFTTokenId
        );

        const proposerNFTContract = new Contract(
          proposerNFTContractAddress,
          [
            "function safeTransferFrom(address from, address to, uint256 tokenId) public",
          ],
          escrowSigner
        );

        const proposeeNFTContract = new Contract(
          proposeeNFTContractAddress,
          [
            "function safeTransferFrom(address from, address to, uint256 tokenId) public",
          ],
          escrowSigner
        );

        await proposeeNFTContract
          ?.safeTransferFrom(
            process.env.ESCROW_EOA_ADDRESS,
            proposer,
            proposeeNFTTokenId,
            {
              maxPriorityFeePerGas: 10e9,
              maxFeePerGas: 15e9,
            }
          )
          .then((receipt) => {
            console.log("Successful transfer ", receipt);
          })
          .catch((err) => {
            console.log("Error transferring NFT ", err);
          });

        await proposerNFTContract
          ?.safeTransferFrom(
            process.env.ESCROW_EOA_ADDRESS,
            proposee,
            proposerNFTTokenId,
            {
              maxPriorityFeePerGas: 10e9,
              maxFeePerGas: 15e9,
            }
          )
          .then((receipt) => {
            console.log("Successful transfer ", receipt);
          })
          .catch((err) => {
            console.log("Error transferring NFT ", err);
          });
      }
    });
  } catch (error) {
    console.log("Error running event listener", error);
  }
};

main();
