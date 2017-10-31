# Vesting ERC20 tokens
In this document, we describe the ERC20 vesting contract specification and implementation,
and give an overview over the smart contracts structure.


## Informal Specification
Here, the "spender" is the one who create the vesting and the "vester" is the one who will get the tokens.

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
1. The spender needs to create a token allowance for the vestingERC20 contract: token.allow(vestingContract.address, amount).

2. The spender creates a deposit on the vesting contract: vestingContract.deposit(token.address, amount).

3. The spender is now able to create a grant: vestingContract.grantVesting(token.address, vester.address, amount, vesting_starting_time, vesting_period, cliff_period)

4. a. At any moment, The spender can revoke a vesting he created. calling: vestingContract.revokeVesting(token.address, vester.address). The tokens already released will be sent directly to the vester and the grant will be deleted. The tokens not sent to the vester will be unlocked for the spender.

4. b. The vester can try to withdraw the released tokens at any time with the call: vestingContract.withdraw(token.address, spender.address)

N.B. If a spender wants to get back his unlocked tokens, he just needs to create a grant to himself with a endTime before now. e.g: vestingContract.grantVesting(token.address, spender.address, amount, 0, 0, 0)


### Per module description
The system has 1 main module: the vesting contract (VestingERC20.sol).


#### The vesting contract (VestingERC20.sol)
Implemented in `VestingERC20.sol`. 

It uses `SafeMath.sol` by Open Zeppelin and `SafeMath64.sol` (which is `SafeMath.sol` modified to handle uint64)

The 4 main externals functions are :
- deposit - Deposit tokens to the contracts
- grantVesting - Create a vesting
- revokeVesting - Revoke a vesting
- withdraw - Get the tokens released from a vesting

and some getters :
- getBalanceVesting - Get the amount of tokens available to withdraw for a vesting
- getBalanceDeposit - Get the amount of tokens of a user not locked on vestings


### Use of zeppelin code
We use open-zeppling code for `SafeMath`. And `ERC20` logic.

# Testrpc commandline
launchTestrpc.bat or launchTestrpc.sh
