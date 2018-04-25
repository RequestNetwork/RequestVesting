# Vesting ERC20 tokens
In this document, we describe the ERC20 vesting contract specification and implementation,
and give an overview over the smart contracts structure.


## Informal Specification
Here, the "granter" is the one who create the vesting and the "vester" is the one who will get the tokens.

A vesting is an amount of a specific token given progressively to someone. The period is defined by the `starting time` (the date you start to accumulate tokens), the `grant period` (number of seconds of the grant) and the `cliff period` (number of seconds before the withdraw is possible).

> ```
>  Tokens Released
>   |                           __________ 	
>   |                         _/ 				
>   |                       _/  
>   |                     _/
>   |                   _/
>   |                 _/
>   |                /
>   |              .|
>   |            .  |
>   |          .    |
>   |        .      |
>   |      .        |
>   |    .          |
>   +===+===========+-----------+---------> time
>      Start       Cliff       End
>	(thank you aragon for this ASCII graph)
> ```

Some specifications:
- Anyone can grant a vesting to anyone (even to himself)
- The contracts support every ERC20 tokens
- A `Cliff period` equals to 0, means that the withraw is directly possible (no cliff).
- A `Cliff period` equals to `Grant period`, means the withraw is possible only after the end of the vesting.


## Detailed description

### Overview of the flow for a grant
1. The granter needs to create a token allowance for the vestingERC20 contract: token.allow(vestingContract.address, amount).

2. The granter creates a deposit on the vesting contract: vestingContract.deposit(token.address, amount).

3. The granter is now able to create a grant: vestingContract.createVesting(token.address, vester.address, amount, vesting_starting_time, vesting_period_in_second, cliff_period_in_second)

4. a. At any moment, The granter can revoke a vesting he created. calling: vestingContract.revokeVesting(token.address, vester.address). The tokens already released will be sent directly to the vester and the grant will be deleted. The tokens not sent to the vester will be unlocked for the granter.

4. b. The vester can try to release the tokens at any time with the call: vestingContract.withdraw(token.address, granter.address, doWithdraw). If doWithdraw is true, the token are directly send to the vester address. Otherwise, the token are available to withdraw or to create a grant.


### Per module description
The system has 1 main module: the vesting contract (VestingERC20.sol).


#### The vesting contract (VestingERC20.sol)
Implemented in `VestingERC20.sol`. 

It uses `SafeMath.sol` by Open Zeppelin and `SafeMath64.sol` (which is `SafeMath.sol` modified to handle uint64)

The 4 main externals functions are :
- deposit - Deposit tokens to the contracts
- createVesting - Create a vesting (from the granter)
- revokeVesting - Revoke a vesting (from the granter)
- releaseGrant - Release (and eventually withdraw) the unlocked tokens of a vesting (from the vester) 
- withdraw - Get the tokens released from a vesting

and some getters :
- getVestingBalance - Get the amount of tokens unlocked for a vesting
- getContractBalance - Get the amount of tokens available on the contract for a user


### Use of zeppelin code
We use open-zeppling code for `SafeMath`. And `ERC20` logic.

# Run testunit
You need first to install the truffle: 
`npm install truffle -g`

then bignumber.js library: 
`npm install bignumber.js`

In another terminal, launch testrpc:
`launchTestrpc.bat` or `launchTestrpc.sh`

and finally launch the tests: 
`truffle test`
