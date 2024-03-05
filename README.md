# What does this do?

Blazingly fast API that estimates transaction fees for using the Avocado wallet, an ERC-4337 Account Abstracted wallet (See https://ethereum.org/en/roadmap/account-abstraction/)  
Supports 5 EVM networks (Ethereum, Arbitrum, Avalanche, Optimism, Polygon)
Simply pass in the actions needed to be performed and this should respond with the estimated fees.  

## What's so special about this? Why not use the official Avocado Api to do this?

This Api is designed to be highly optimised for response times (Less than 2secs) for any number of actions passed compared to the official Avocado gas estimation API which takes anywhere between 6-8secs.  
This was possible by re-writing the core logic of fee estimation by the Avocado broadcaster which includes simulating transactions on the network and calculating gas limits based on the actions passed to the API.








