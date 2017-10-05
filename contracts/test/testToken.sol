pragma solidity ^0.4.13;

import '../base/token/StandardToken.sol';
import '../base/ownership/Ownable.sol';

// Request Network Token (Kyber Style)
contract TestToken is StandardToken, Ownable {
    string  public  constant name = "Test Token";
    string  public  constant symbol = "TEST";
    uint    public  constant decimals = 18;

    function TestToken(uint tokenTotalAmount) 
    {
        // Mint all tokens. Then disable minting forever.
        totalSupply = tokenTotalAmount * (10 ** uint256(decimals));

        balances[msg.sender] = totalSupply;
        Transfer(address(0x0), msg.sender, totalSupply);
    }
}
