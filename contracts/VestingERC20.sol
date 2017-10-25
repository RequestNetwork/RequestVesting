pragma solidity 0.4.15;

import './base/token/ERC20.sol';
import './base/math/SafeMath.sol';
import './base/math/SafeMath64.sol';
import './base/lifecycle/Pausable.sol';

/**
 * @title VestingERC20
 * @dev VestingERC20 is a contract for managing vesting of ERC20 Token.
 * @dev The tokens are unlocked continuously to the vester.
 * @dev The contract host the tokens that are locked for the vester.
 */
contract VestingERC20 is Pausable{
	using SafeMath for uint256;
	using SafeMath64 for uint64;

	struct Grant {
		uint256 amountInitial;
		uint64 startTime;
		uint64 cliffTime;
		uint64 endTime;
		uint256 amountWithdraw;
	}

	// list of the grants (token => from => to => => Grant)
	mapping(address => mapping(address => mapping(address => Grant))) public grants; 

	// Ledger of the tokens hodled in this contract (token => from => balance)
	mapping(address => mapping(address => uint256)) public tokens;

	event NewGrant(address from, address to, address token, uint256 amountInitial, uint64 startTime, uint64 cliffTime, uint64 endTime);
	event GrantRevoked(address from, address to, address token);
    event Deposit(address token, address from, uint amount, uint balance);
    event Withdraw(address token, address from, address to, uint amount);

	/**
	 * @dev Grant a vesting to an ethereum address
	 *
	 * Only owner can grant token to an address vested between two dates.
	 * If there is not enough available token on the contract, an exception is thrown
	 *
	 * @param _to The address where the token will be sent.
	 * @param _token The ERC20 token concerned
	 * @param _amountInitial The amount of tokens to be sent during the vesting period.
	 * @param _startTime The time when the vesting starts.
	 * @param _grantPeriod The period of the grant in sec.
	 * @param _cliffPeriod The period in sec during which time the tokens cannot be withraw
	 */
	function grantVesting(
			address _to,  
			address _token, 
			uint256 _amountInitial,
			uint64 _startTime,
			uint64 _grantPeriod,
			uint64 _cliffPeriod) 
		public
		whenNotPaused
	{
		require(_to != 0);
		require(_cliffPeriod <= _grantPeriod);
		require(_amountInitial != 0);

		// sender does not hava a grant yet
		require(grants[_token][msg.sender][_to].amountInitial==0);

		var cliffTime = _startTime.add(_cliffPeriod);
		var endTime = _startTime.add(_grantPeriod);

		grants[_token][msg.sender][_to] = Grant(_amountInitial, _startTime, cliffTime, endTime, 0);

		// update the balance
		tokens[_token][msg.sender] = tokens[_token][msg.sender].sub(_amountInitial);

		NewGrant(msg.sender, _to, _token, _amountInitial, _startTime, cliffTime, endTime);
	}

	/**
	 * @dev Revoke a vesting 
	 *
	 * Only owner can revoke a vesting
	 * The vesting is deleted and the the tokens already released are sent to the vester
	 *
	 * @param _to The address of the vester.
	 * @param _token The address of the token.
	 */
	function revokeVesting(address _to, address _token) 
		public
		whenNotPaused
	{
		require(_to != 0);

		Grant storage _grant = grants[_token][msg.sender][_to];

		// send token available
		sendTokenReleased(_token, msg.sender, _to);

		// unlock the tokens reserved for this grant
		tokens[_token][msg.sender] = 
			tokens[_token][msg.sender].add(
				_grant.amountInitial.sub(_grant.amountWithdraw)
			);

		// delete the grants
		delete grants[_token][msg.sender][_to];

		GrantRevoked(msg.sender, _to, _token);
	}

	/**
	 * @dev Withdraw token released to msg.sender
	 *
	 * The token released for the msg.sender are sent and his amountWithdraw are updated
	 * If there is nothing the send, an exception is thrown.

	 * @param _from The address of the spender.
	 * @param _token The address of the token.
	 */
	function withdraw(address _token, address _from) 
		public
		whenNotPaused
	{
		// send token to the vester
		sendTokenReleased(_token, _from, msg.sender);

		// delete grant if fully withdraw
		Grant storage _grant = grants[_token][_from][msg.sender];
		if(_grant.amountInitial != 0 && _grant.amountInitial == _grant.amountWithdraw) 
		{
			delete grants[_token][_from][msg.sender];
		}
	}

	/**
	 * @dev Send the token released to an address
	 *
	 * The token released for the address are sent and his amountWithdraw are updated
	 * If there is nothing the send, return false.
	 * 
	 * @param _token The address of the token.
	 * @param _from The address of the spender.
	 * @param _to The address of the vester.
	 * @return true if tokens have been send, false otherwise.
	 */
	function sendTokenReleased(address _token, address _from, address _to) 
		internal
		returns(bool)
	{
		Grant storage _grant = grants[_token][_from][_to];
		uint256 amountToSend = getBalanceVestingInternal(_grant);

		// update amountWithdraw
		_grant.amountWithdraw = _grant.amountWithdraw.add(amountToSend);

		Withdraw(_token, _from, _to, amountToSend);

		// send token to the vester
		return ERC20(_token).transfer(_to, amountToSend);
	}

	/**
	 * @dev Compute the amount of token released for an address
	 * 
	 * @param _grant Grant information
	 * @return the number of tokens released
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
			return _grant.amountInitial.sub(_grant.amountWithdraw);
		}
		else
		{
			// token available = ( (amountInitial / (endTime - startTime)) * (now - startTime) ) - amountWithdraw
			//	=> in other words : (number_of_token_granted_per_second * second_since_grant_started) - amount_already_withdraw
			return _grant.amountInitial.div( 
						_grant.endTime.sub(_grant.startTime) 
					).mul(
						now.sub(_grant.startTime)
					).sub(_grant.amountWithdraw);
		}
	}

	function getBalanceVesting(address _token, address _from, address _to) 
		public
		constant 
		returns(uint256) 
	{
		Grant memory _grant = grants[_token][_from][_to];
		return getBalanceVestingInternal(_grant);
	}

	/**
	 * @dev Get the token balance of the contract
	 * 
	 * @return the number of tokens on the contract for _from
	 */
	function getBalanceDeposit(address _token, address _from) 
		public
		constant 
		returns(uint256) 
	{
		return tokens[_token][_from];
	}

	/**
	 * @dev Get the token balance of the contract
	 * 
	 * @return the number of tokens on the contract
	 */
	function deposit(address _token, uint256 _amount) 
		public
		returns(uint256) 
	{
        require(_token!=0);
        require(ERC20(_token).transferFrom(msg.sender, this, _amount));
        tokens[_token][msg.sender] = tokens[_token][msg.sender].add(_amount);
        Deposit(_token, msg.sender, _amount, tokens[_token][msg.sender]);

		return tokens[_token][msg.sender];
	}
}

