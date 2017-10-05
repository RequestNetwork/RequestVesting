var VestingERC20 = artifacts.require("./VestingERC20.sol");
var TestToken = artifacts.require("./test/TestToken.sol");
var BigNumber = require('bignumber.js');


// Copy & Paste this
Date.prototype.getUnixTime = function() { return this.getTime()/1000|0 };
if(!Date.now) Date.now = function() { return new Date(); }
Date.time = function() { return Date.now().getUnixTime(); }

var expectThrow = async function(promise) {
  try {
    await promise;
  } catch (error) {
    const invalidOpcode = error.message.search('invalid opcode') >= 0;
    const invalidJump = error.message.search('invalid JUMP') >= 0;
    const outOfGas = error.message.search('out of gas') >= 0;
    assert(
      invalidOpcode || invalidJump || outOfGas,
      "Expected throw, got '" + error + "' instead",
    );
    return;
  }
  assert.fail('Expected throw not received');
};


contract('Creation Token Sale', function(accounts) {
	// account setting ----------------------------------------------------------------------
	var admin = accounts[0];
	var guy1 = accounts[1];
	var guy2 = accounts[2];
	var guy3 = accounts[3];

	// tool const ----------------------------------------------------------------------------
	const day = 60 * 60 * 24 * 1000;
	const dayInsecond = 60 * 60 * 24;
	const second = 1000;
	const decimals = 18;

	// crowdsale setting ---------------------------------------------------------------------
	var amountTokenSupply = 1000000000;
	amountTokenSupply = (new BigNumber(10).pow(decimals)).mul(amountTokenSupply);

	var currentTimeStamp;
	var startTimeSolidity;
	var endTimeSolidity;

    // variable to host contracts ------------------------------------------------------------
	var vestingERC20;
	var testToken;


	it("regular vesting", async function() {
		// create token
		testToken = await TestToken.new(amountTokenSupply);

		// create vesting
		vestingERC20 = await VestingERC20.new(testToken.address);

		// send token to the vesting
		await testToken.transfer(vestingERC20.address, amountTokenSupply);

		assert(amountTokenSupply.equals(await vestingERC20.getTokenOnContract.call()), "getTokenOnContract is wrong");
		assert.equal(await vestingERC20.token.call(), testToken.address, "token is wrong");

		startTimeSolidity = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
		endTimeSolidity = startTimeSolidity + 1000*dayInsecond;

		var grantToGuy1 = 1000000;
		var amountTokenVestGuy1 = (new BigNumber(10).pow(decimals)).mul(grantToGuy1);

		await vestingERC20.grantVesting(guy1, 
											amountTokenVestGuy1,    
								            startTimeSolidity,
								            endTimeSolidity);

		assert(amountTokenVestGuy1.equals(await vestingERC20.amountTotalLocked.call()), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy1);
		assert(grantsGuy1[0].equals(amountTokenVestGuy1), "amountInitial is wrong");
		assert.equal(grantsGuy1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsGuy1[2], endTimeSolidity, "endtime is wrong");
		assert.equal(grantsGuy1[3], 0, "AmountWithdraw is wrong");

		var arrayTest = [[1,1000],[5,5000],[10,10000],[50,50000],[100,100000],[500,500000],[999,999000],[1000,1000000],[1001,1000000]];;

		var lastTime = 0;
		// for(var ind=0;ind<arrayTest.length;ind++) {
		// 	var a = arrayTest[ind];
		// 	var padding = a[0]-lastTime;
			
		// 	addsDayOnEVM(padding);
		// 	assert( isAround(await vestingERC20.getTokenAmountReleased(guy1), (new BigNumber(10).pow(decimals)).mul(a[1])), a[0]+" getTokenAmountReleased wrong ");
		// 	lastTime = a[0];
		// }


		// addsDayOnEVM(1001);// TO DELETE § TODO
		// var r = await vestingERC20.withdraw({from:guy1});


		// assert((new BigNumber(10).pow(18)).mul(1000000).equals(await testToken.balanceOf(guy1)), "guy1 balance");

		// assert(amountTokenSupply.sub(new BigNumber(10).pow(18).mul(1000000)).equals(await testToken.balanceOf(vestingERC20.address)), "vestingERC20 balance");


		// addsDayOnEVM(1001);// TO DELETE § TODO
		// var r = await vestingERC20.revokeVesting(guy1, {from:admin});	

		// assert((new BigNumber(10).pow(18)).mul(1000000).equals(await testToken.balanceOf(guy1)), "guy1 balance");

		// assert(amountTokenSupply.sub(new BigNumber(10).pow(18).mul(1000000)).equals(await testToken.balanceOf(vestingERC20.address)), "vestingERC20 balance");

		// var grantsGuy1 = await vestingERC20.grants.call(guy1);
		// assert(grantsGuy1[0].equals(0), "amountInitial is wrong");
		// assert.equal(grantsGuy1[1], 0, "startTime is wrong");
		// assert.equal(grantsGuy1[2], 0, "endtime is wrong");
		// assert.equal(grantsGuy1[3], 0, "AmountWithdraw is wrong");


		addsDayOnEVM(500);// TO DELETE § TODO
		var r = await vestingERC20.revokeVesting(guy1, {from:admin});	

		assert( isAround(await vestingERC20.getTokenAmountReleased(guy1), (new BigNumber(10).pow(decimals)).mul(500000)), "getTokenAmountReleased wrong ");

		assert( isAround(amountTokenSupply.sub(new BigNumber(10).pow(18).mul(500000)), await testToken.balanceOf(vestingERC20.address)), "vestingERC20 balance");

		var grantsGuy1 = await vestingERC20.grants.call(guy1);
		assert(grantsGuy1[0].equals(0), "amountInitial is wrong");
		assert.equal(grantsGuy1[1], 0, "startTime is wrong");
		assert.equal(grantsGuy1[2], 0, "endtime is wrong");
		assert.equal(grantsGuy1[3], 0, "AmountWithdraw is wrong");


	});

	var isAround = function(a,b,precision) {
		precision = precision ? precision : 1;
		return a.sub(b).lte(a.mul(precision).div(100));
	}

	var addsDayOnEVM = async function(days) {
		var daysInsecond = 60 * 60 * 24 * days 
		var currentBlockTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
		await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [daysInsecond], id: 0});
		await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
	}
});


