pragma solidity ^0.4.11;

import './base/token/StandardToken.sol';
import './base/math/SafeMath.sol';
import './base/ownership/Ownable.sol';

/**
 * @title VestingERC20
 * @dev VestingERC20 is a contract for managing vesting of ERC20 Token.
 * @dev The tokens are unlocked continuously to the vester.
 * @dev The contract host the tokens that are locked for the vester.
 */
contract VestingERC20 is Ownable{
    using SafeMath for uint256;
    using SafeMath for uint64;

    // The token being vested
    ERC20 public token;

    // Vester
    struct Grant {
        uint256 amountInitial;     
        uint64 startTime;
        uint64 endTime;
        uint256 amountWithdraw;
    }
    mapping(address => Grant) public grants;

    uint256 public amountTotalLocked; // total of token locked on the contract

    event NewGrant(address _to,uint256 _amountInitial,uint64 _startTime, uint64 _endTime);
    event GrantRevoked(address _to);


    function VestingERC20(ERC20 _token) 
    {
        token = _token;
        amountTotalLocked = 0;
    }


    /**
     * @dev Grant a vesting to an ethereum address
     *
     * Only owner can grant token to an address vested between two dates.
     * If there is not enough available token on the contract, an exception is thrown
     *
     * @param _to The address where the token will be sent.
     * @param _amountInitial The amount of tokens to be sent during the vesting period.
     * @param _startTime The time when the vesting starts.
     * @param _endTime The time when the vesting ends.
     */
    function grantVesting(
            address _to,   
            uint256 _amountInitial,
            uint64 _startTime,
            uint64 _endTime) 
        public
        onlyOwner
    {
        require(_to != 0);
        require(_startTime < _endTime);
        require(_amountInitial != 0);

        // sender does not hava a grant yet
        require(grants[_to].amountInitial==0);

        // check if there is enough token not locked
        require(amountTotalLocked.add(_amountInitial) <= getTokenOnContract());

        grants[_to] = Grant(_amountInitial, _startTime, _endTime, 0);

        // lock the tokens
        amountTotalLocked = amountTotalLocked.add(_amountInitial);

        NewGrant(_to, _amountInitial, _startTime, _endTime);
    }

    /**
     * @dev Revoke a vesting 
     *
     * Only owner can revoke a vesting
     * The vesting is deleted and the the tokens already released are sent to the vester
     *
     * @param _to The address of the vester.
     */
    function revokeVesting(address _to) 
        public
        onlyOwner
    {
        // send token available
        sendTokenReleased(_to);

        // unlock the tokens reserved for this grant
        amountTotalLocked = amountTotalLocked.add(grants[_to].amountInitial.sub(grants[_to].amountWithdraw));

        // delete the grants
        delete grants[_to];

        GrantRevoked(_to);
    }

    /**
     * @dev Withdraw token released to msg.sender
     *
     * The token released for the msg.sender are sent and his amountWithdraw are updated
     * If there is nothing the send, an exception is thrown.
     */
    function withdraw() 
        public
    {
        // send token to the vester
        require(sendTokenReleased(msg.sender));
    }

    /**
     * @dev Send the token released to an address
     *
     * The token released for the address are sent and his amountWithdraw are updated
     * If there is nothing the send, return false.
     * 
     * @param _to The address of the vester.
     * @return true if tokens have been send, false otherwise.
     */
    function sendTokenReleased(address _to) 
        internal
        returns(bool)
    {
        uint256 amountToSend = getTokenAmountReleased(_to).sub(grants[_to].amountWithdraw);

        if(amountToSend == 0) return false;

        // update amountWithdraw
        grants[_to].amountWithdraw = grants[_to].amountWithdraw.add(amountToSend);

        // unlock the tokens
        amountTotalLocked = amountTotalLocked.sub(amountToSend);

        // send token to the vester
        return token.transfer(_to, amountToSend);
    }

    /**
     * @dev Compute the amount of token released for an address
     * 
     * @param _to The address of the vester.
     * @return the number of tokens released
     */
    function getTokenAmountReleased(address _to)
        public
        constant
        returns(uint256)
    {
        if(now < grants[_to].startTime)
        {
            // the grant didn't start 
            return 0;
        }
        else if(now >= grants[_to].endTime)
        {
            // after the end of the grant release everything
            return grants[_to].amountInitial;
        }
        else
        {
            // token available = (amountInitial / (endTime - startTime)) * (now - startTime)
            //    => in other words : number_of_token_granted_per_second * second_since_grant_started 
            return grants[_to].amountInitial.div( 
                        grants[_to].endTime.sub(grants[_to].startTime) 
                    ).mul(
                        now.sub(grants[_to].startTime)
                    );
        }
    }

    /**
     * @dev Get the token balance of the contract
     * 
     * @return the number of tokens on the contract
     */
    function getTokenOnContract() 
        public
        constant 
        returns(uint256) 
    {
        return token.balanceOf(address(this));
    }


    /**
     * @dev Drain specified tokens sent to this contract to the owner
     * 
     * Only owner can drain tokens
     * Token of this vesting cannot be drained
     * 
     * @param _token Token we want to drain
     * @param _amount Amount we want to drain
     */
    function emergencyERC20Drain(ERC20 _token, uint _amount ) 
        public
        onlyOwner 
    {
        require(_token!=token); 
        _token.transfer(owner, _amount);
    }
}

