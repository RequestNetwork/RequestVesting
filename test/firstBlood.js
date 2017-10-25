
var VestingERC20 = artifacts.require("./VestingERC20.sol");
// var VestingERC20 = artifacts.require("./VestingERC20OptiHash.sol");
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
	var spender1 = accounts[1];
	var spender2 = accounts[2];
	var vester1 = accounts[3];
	var vester2 = accounts[3];

	// tool const ----------------------------------------------------------------------------
	const day = 60 * 60 * 24 * 1000;
	const dayInsecond = 60 * 60 * 24;
	const second = 1000;
	const decimals = 18;

	// crowdsale setting ---------------------------------------------------------------------
	var amountTokenSupply = 1000000000;
	amountTokenSupply = (new BigNumber(10).pow(decimals)).mul(amountTokenSupply);

	var spender1Supply = amountTokenSupply.div(10);
	var spender2Supply = amountTokenSupply.div(10);

	var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
	var cliffPeriodS1V1 = 200*dayInsecond;
	var grantPeriodS1V1 = 1000*dayInsecond;

	grantSpender2toVester2 = (new BigNumber(10).pow(decimals)).mul(1000);
	var cliffPeriodS2V2 = 200*dayInsecond;
	var grantPeriodS2V2 = 1000*dayInsecond;

    // variable to host contracts ------------------------------------------------------------
	var vestingERC20;
	var testToken;


	it("regular vesting", async function() {
		// create vesting contract
		vestingERC20 = await VestingERC20.new();

		// create token
		testToken = await TestToken.new(amountTokenSupply);
		// send token to the futur spender
		await testToken.transfer(spender1, spender1Supply, {from: admin});
		await testToken.transfer(spender2, spender2Supply, {from: admin});


		// spender1 grant to vester1 -----------------------------------------------
			// spender1 deposit
		await testToken.approve(vestingERC20.address, spender1Supply, {from: spender1});
		var r = await vestingERC20.deposit(testToken.address, spender1Supply, {from: spender1});
		console.log(r.receipt.cumulativeGasUsed);

		assert.equal(r.logs[0].event, 'Deposit', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(spender1Supply), "amount is wrong");
		assert(r.logs[0].args.balance.equals(spender1Supply), "balance is wrong");

		// assert((await vestingERC20.tokens.call(testToken.address, spender1)).equals(spender1Supply), "spender1SupplyOnContract is wrong");

			// create the grant
		var startTimeSolidity = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

		var r = await vestingERC20.grantVesting(vester1, testToken.address, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});
		console.log(r.receipt.cumulativeGasUsed);
		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amountInitial.equals(grantSpender1toVester1), "amountInitial is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.tokens.call(testToken.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grants.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1), "amountInitial is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "amountWithdraw is wrong");


		var arrayTest = [/*[1,0],[5,0],[10,0],[50,0],[100,0],[199,0],[200,200],[500,500],[999,999],[1000,1000],*/[1001,1000]];;

		var lastTime = 0;
		for(var ind=0;ind<arrayTest.length;ind++) {
			var a = arrayTest[ind];			
			addsDayOnEVM(a[0]-lastTime);
			assert( areAlmostEquals(await vestingERC20.getBalanceVesting(testToken.address, spender1, vester1), (new BigNumber(10).pow(decimals)).mul(a[1])), a[0]+"=>"+a[1]+" getTokenAmountReleased wrong ");
			lastTime = a[0];
		}

		var r = await vestingERC20.withdraw(testToken.address, spender1, {from:vester1});
		console.log(r.receipt.cumulativeGasUsed);
		var grantsS1toV1 = await vestingERC20.grants(testToken.address, spender1, vester1);
		assert.equal(grantsS1toV1[0], 0, "amountInitial is wrong");
		assert.equal(grantsS1toV1[1], 0, "startTime is wrong");
		assert.equal(grantsS1toV1[2], 0, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], 0, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "amountWithdraw is wrong");

		assert(grantSpender1toVester1.equals(await testToken.balanceOf(vester1)), "vester1 balance");



/*
		// ********** Check revoking *******************
		// spender2 grant to vester2 -----------------------------------------------
			// spender2 deposit
		await testToken.approve(vestingERC20.address, spender2Supply, {from: spender2});
		var r = await vestingERC20.deposit(testToken.address, spender2Supply, {from: spender2});

		assert.equal(r.logs[0].event, 'Deposit', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(spender2Supply), "amount is wrong");
		assert(r.logs[0].args.balance.equals(spender2Supply), "balance is wrong");

		assert((await vestingERC20.tokens.call(testToken.address, spender2)).equals(spender2Supply), "spender2SupplyOnContract is wrong");


		startTimeSolidity = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

		var r = await vestingERC20.grantVesting(vester2, testToken.address, grantSpender2toVester2, 
											startTimeSolidity, grantPeriodS2V2, cliffPeriodS2V2,
											 {from: spender2});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amountInitial.equals(grantSpender2toVester2), "amountInitial is wrong");
		assert.equal(r.logs[0].args.from, spender2, "from is wrong");
		assert.equal(r.logs[0].args.to, vester2, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS2V2), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS2V2), "endTime is wrong");

		assert((await vestingERC20.tokens.call(testToken.address, spender2)).equals(spender2Supply.minus(grantSpender2toVester2)), "spender2SupplyOnContract is wrong");

		var grantsS2toV2 = await vestingERC20.grants.call(testToken.address, spender2, vester2);
		assert(grantsS2toV2[0].equals(grantSpender2toVester2), "amountInitial is wrong");
		assert.equal(grantsS2toV2[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS2toV2[2], startTimeSolidity+cliffPeriodS2V2, "cliffTime is wrong");
		assert.equal(grantsS2toV2[3], startTimeSolidity+grantPeriodS2V2, "endtime is wrong");
		assert.equal(grantsS2toV2[4], 0, "amountWithdraw is wrong");


*/

/*


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
*/

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

	var areAlmostEquals = function(a,b,precision) {
		if(a.lt(b)) {
			var temp = a;
			a = b;
			b = temp;
		}
		precision = precision ? precision : 1;
		return a.sub(b).lte(a.mul(precision).div(100));
	}
});


