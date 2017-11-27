pragma solidity 0.4.18;

import './base/token/ERC20.sol';
import './base/math/SafeMath.sol';
import './base/math/SafeMath64.sol';


/**
 * @title VestingERC20
 * @dev VestingERC20 is a contract for managing vesting of ERC20 Token.
 * @dev The tokens are unlocked continuously to the vester.
 * @dev The contract host the tokens that are locked for the vester.
 */
contract VestingERC20 {
	using SafeMath for uint256;
	using SafeMath64 for uint64;

	struct Grant {
		uint256 vestedAmount;
		uint64 startTime;
		uint64 cliffTime;
		uint64 endTime;
		uint256 withdrawnAmount;
	}

	// list of the grants (token => from => to => => Grant).
	mapping(address => mapping(address => mapping(address => Grant))) public grantsPerVesterPerSpenderPerToken;

	// Ledger of the tokens hodled (this not a typo ;) ) in this contract (token => user => balance).
	mapping(address => mapping(address => uint256)) public balancePerPersonPerToken;


	event NewGrant(address from, address to, address token, uint256 vestedAmount, uint64 startTime, uint64 cliffTime, uint64 endTime);
	event GrantRevoked(address from, address to, address token);
  event Deposit(address token, address from, uint amount, uint balance);
  event TokenReleased(address token, address from, address to, uint amount);

	/**
	 * @dev Grant a vesting to an ethereum address.
	 *
	 * If there is not enough tokens available on the contract, an exception is thrown.
	 *
	 * @param _token The ERC20 token contract address.
	 * @param _to The address where the token will be sent.
	 * @param _vestedAmount The amount of tokens to be sent during the vesting period.
	 * @param _startTime The time when the vesting starts.
	 * @param _grantPeriod The period of the grant in sec.
	 * @param _cliffPeriod The period in sec during which time the tokens cannot be withraw.
	 */
	function grantVesting(
			address _token, 
			address _to,  
			uint256 _vestedAmount,
			uint64 _startTime,
			uint64 _grantPeriod,
			uint64 _cliffPeriod) 
		external
	{
		require(_token != 0);
		require(_to != 0);
		require(_cliffPeriod <= _grantPeriod);
		require(_vestedAmount != 0);
		require(_grantPeriod==0 || _vestedAmount * _grantPeriod >= _vestedAmount); // no overflow allow here! (to make getBalanceVestingInternal safe).

		// verify that there is not already a grant between the addresses for this specific contract.
		require(grantsPerVesterPerSpenderPerToken[_token][msg.sender][_to].vestedAmount==0);

		var cliffTime = _startTime.add(_cliffPeriod);
		var endTime = _startTime.add(_grantPeriod);

		grantsPerVesterPerSpenderPerToken[_token][msg.sender][_to] = Grant(_vestedAmount, _startTime, cliffTime, endTime, 0);

		// update the balance
		balancePerPersonPerToken[_token][msg.sender] = balancePerPersonPerToken[_token][msg.sender].sub(_vestedAmount);

		NewGrant(msg.sender, _to, _token, _vestedAmount, _startTime, cliffTime, endTime);
	}

	/**
	 * @dev Revoke a vesting
	 *
	 * The vesting is deleted and the tokens already released are sent to the vester.
	 *
	 * @param _token The address of the token.
	 * @param _to The address of the vester.
	 */
	function revokeVesting(address _token, address _to) 
		external
	{
		require(_token != 0);
		require(_to != 0);

		Grant storage _grant = grantsPerVesterPerSpenderPerToken[_token][msg.sender][_to];

		// verify if the grant exists
		require(_grant.vestedAmount!=0);

		// send token available
		sendTokenReleasedToBalance(_token, msg.sender, _to);

		// unlock the tokens reserved for this grant
		balancePerPersonPerToken[_token][msg.sender] = 
			balancePerPersonPerToken[_token][msg.sender].add(
				_grant.vestedAmount.sub(_grant.withdrawnAmount)
			);

		// delete the grants
		delete grantsPerVesterPerSpenderPerToken[_token][msg.sender][_to];

		GrantRevoked(msg.sender, _to, _token);
	}

	/**
	 * @dev Send the relaesed token to the user balance and eventually withdraw
	 *
	 * Put the tokens released to the user balance.
	 * If _doWithdraw is true, send the whole balance to the user.

	 * @param _token The address of the token.
	 * @param _from The address of the spender.
	 * @param _doWithdraw bool, true to withdraw in the same time.
	 */
	function releaseGrant(address _token, address _from, bool _doWithdraw) 
		external
	{
		// send token to the vester
		sendTokenReleasedToBalance(_token, _from, msg.sender);

		if(_doWithdraw) {
			withdraw(_token);			
		}

		// delete grant if fully withdrawn
		Grant storage _grant = grantsPerVesterPerSpenderPerToken[_token][_from][msg.sender];
		if(_grant.vestedAmount == _grant.withdrawnAmount) 
		{
			delete grantsPerVesterPerSpenderPerToken[_token][_from][msg.sender];
		}
	}

	/**
	 * @dev Withdraw tokens avaibable
	 *
	 * The tokens are sent to msg.sender and his balancePerPersonPerToken is updated to zero.
	 * If there is the token transfer fail, the transaction is revert.
	 *
	 * @param _token The address of the token.
	 */
	function withdraw(address _token) 
		public
	{
		uint amountToSend = balancePerPersonPerToken[_token][msg.sender];
		balancePerPersonPerToken[_token][msg.sender] = 0;
		require(ERC20(_token).transfer(msg.sender, amountToSend));
	}

	/**
	 * @dev Send the token released to the balance address
	 *
	 * The token released for the address are sent and his withdrawnAmount are updated.
	 * If there is nothing the send, return false.
	 * 
	 * @param _token The address of the token.
	 * @param _from The address of the spender.
	 * @param _to The address of the vester.
	 * @return true if tokens have been sent.
	 */
	function sendTokenReleasedToBalance(address _token, address _from, address _to) 
		internal
	{
		Grant storage _grant = grantsPerVesterPerSpenderPerToken[_token][_from][_to];
		uint256 amountToSend = getBalanceVestingInternal(_grant);

		// update withdrawnAmount
		_grant.withdrawnAmount = _grant.withdrawnAmount.add(amountToSend);

		TokenReleased(_token, _from, _to, amountToSend);

		// send tokens to the vester's balance
		balancePerPersonPerToken[_token][_to] = balancePerPersonPerToken[_token][_to].add(amountToSend); 
	}

	/**
	 * @dev Calculate the amount of tokens released for a grant
	 * 
	 * @param _grant Grant information.
	 * @return the number of tokens released.
	 */
	function getBalanceVestingInternal(Grant _grant)
		internal
		constant
		returns(uint256)
	{
		if(now < _grant.cliffTime) 
		{
			// the grant didn't start 
			return 0;
		}
		else if(now >= _grant.endTime)
		{
			// after the end of the grant release everything
			return _grant.vestedAmount.sub(_grant.withdrawnAmount);
		}
		else
		{
			//  token available = vestedAmount * (now - startTime) / (endTime - startTime)  - withdrawnAmount
			//	=> in other words : (number_of_token_granted_per_second * second_since_grant_started) - amount_already_withdraw
			return _grant.vestedAmount.mul( 
						now.sub(_grant.startTime)
					).div(
						_grant.endTime.sub(_grant.startTime) 
					).sub(_grant.withdrawnAmount);
		}
	}

	/**
	 * @dev Get the amount of tokens released for a vesting
	 * 
	 * @param _token The address of the token.
	 * @param _from The address of the spender.
	 * @param _to The address of the vester.
	 * @return the number of tokens available.
	 */
	function getBalanceVesting(address _token, address _from, address _to) 
		external
		constant 
		returns(uint256) 
	{
		Grant memory _grant = grantsPerVesterPerSpenderPerToken[_token][_from][_to];
		return getBalanceVestingInternal(_grant);
	}

	/**
	 * @dev Get the token balance of the contract
	 * 
	 * @param _token The address of the token.
	 * @param _user The address of the user.
	 * @return the balance of tokens on the contract for _user.
	 */
	function getBalance(address _token, address _user) 
		external
		constant 
		returns(uint256) 
	{
		return balancePerPersonPerToken[_token][_user];
	}

	/**
	 * @dev Make a deposit of tokens on the contract
	 *
	 * Before using this function the user needs to do a token allowance from the user to the contract.
	 *
	 * @param _token The address of the token.
	 * @param _amount Amount of token to deposit.
	 * 
	 * @return the balance of tokens on the contract for msg.sender.
	 */
	function deposit(address _token, uint256 _amount) 
		external
		returns(uint256) 
	{
    require(_token!=0);
    require(ERC20(_token).transferFrom(msg.sender, this, _amount));
    balancePerPersonPerToken[_token][msg.sender] = balancePerPersonPerToken[_token][msg.sender].add(_amount);
    Deposit(_token, msg.sender, _amount, balancePerPersonPerToken[_token][msg.sender]);

		return balancePerPersonPerToken[_token][msg.sender];
	}
}

