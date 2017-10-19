// return;

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


contract('Grant Vesting vesters', function(accounts) {
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

	var grantToGuy1 = 1000;
	grantToGuy1 = (new BigNumber(10).pow(decimals)).mul(grantToGuy1);

	var grantToGuy2 = 2000;
	grantToGuy2 = (new BigNumber(10).pow(decimals)).mul(grantToGuy2);

	var grantToGuy3 = 2000;
	grantToGuy3 = (new BigNumber(10).pow(decimals)).mul(grantToGuy3);


	// variable to host contracts ------------------------------------------------------------
	var vestingERC20;
	var testToken;


	beforeEach(async () => {
		// create token
		testToken = await TestToken.new(amountTokenSupply);

		// create vesting
		vestingERC20 = await VestingERC20.new(testToken.address);

		// send token to the vesting
		await testToken.transfer(vestingERC20.address, amountTokenSupply);

		// time
		currentTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

	});


	it("Grant Vesting to three vesters", async function() {
		// grantVesting by owner
		var startTimeSolidity = currentTimeStamp;
		var cliffTimeSolidity = startTimeSolidity + 100*dayInsecond;
		var endTimeSolidity = startTimeSolidity + 1000*dayInsecond;

		var r = await vestingERC20.grantVesting(guy1, 
											grantToGuy1,    
								            startTimeSolidity,
								            cliffTimeSolidity,
								            endTimeSolidity,
								            {from: admin});

		// event NewGrant(to, amountInitial, startTime, cliffTime, endTime)
		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.to, guy1, "to is wrong");
		assert(r.logs[0].args.amountInitial.equals(grantToGuy1), "amountInitial is wrong");
		assert.equal(r.logs[0].args.startTime, startTimeSolidity, "startTime is wrong");
		assert.equal(r.logs[0].args.cliffTime, cliffTimeSolidity, "cliffTime is wrong");
		assert.equal(r.logs[0].args.endTime, endTimeSolidity, "endTime is wrong");

		assert(grantToGuy1.equals(await vestingERC20.amountTotalLocked.call()), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy1);
		assert(grantsGuy1[0].equals(grantToGuy1), "amountInitial is wrong");
		assert.equal(grantsGuy1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsGuy1[2], cliffTimeSolidity, "clifTime is wrong");
		assert.equal(grantsGuy1[3], endTimeSolidity, "endtime is wrong");
		assert.equal(grantsGuy1[4], 0, "AmountWithdraw is wrong");



		var r = await vestingERC20.grantVesting(guy2, 
											grantToGuy2,    
								            startTimeSolidity,
								            cliffTimeSolidity,
								            endTimeSolidity,
								            {from: admin});

		// event NewGrant(to, amountInitial, startTime, cliffTime, endTime)
		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.to, guy2, "to is wrong");
		assert(r.logs[0].args.amountInitial.equals(grantToGuy2), "amountInitial is wrong");
		assert.equal(r.logs[0].args.startTime, startTimeSolidity, "startTime is wrong");
		assert.equal(r.logs[0].args.cliffTime, cliffTimeSolidity, "cliffTime is wrong");
		assert.equal(r.logs[0].args.endTime, endTimeSolidity, "endTime is wrong");

		assert(grantToGuy1.add(grantToGuy2).equals(await vestingERC20.amountTotalLocked.call()), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy2);
		assert(grantsGuy1[0].equals(grantToGuy2), "amountInitial is wrong");
		assert.equal(grantsGuy1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsGuy1[2], cliffTimeSolidity, "clifTime is wrong");
		assert.equal(grantsGuy1[3], endTimeSolidity, "endtime is wrong");
		assert.equal(grantsGuy1[4], 0, "AmountWithdraw is wrong");

		var r = await vestingERC20.grantVesting(guy3, 
											grantToGuy3,    
								            startTimeSolidity,
								            cliffTimeSolidity,
								            endTimeSolidity,
								            {from: admin});

		// event NewGrant(to, amountInitial, startTime, cliffTime, endTime)
		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.to, guy3, "to is wrong");
		assert(r.logs[0].args.amountInitial.equals(grantToGuy3), "amountInitial is wrong");
		assert.equal(r.logs[0].args.startTime, startTimeSolidity, "startTime is wrong");
		assert.equal(r.logs[0].args.cliffTime, cliffTimeSolidity, "cliffTime is wrong");
		assert.equal(r.logs[0].args.endTime, endTimeSolidity, "endTime is wrong");

		assert(grantToGuy1.add(grantToGuy2).add(grantToGuy3).equals(await vestingERC20.amountTotalLocked.call()), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy3);
		assert(grantsGuy1[0].equals(grantToGuy3), "amountInitial is wrong");
		assert.equal(grantsGuy1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsGuy1[2], cliffTimeSolidity, "clifTime is wrong");
		assert.equal(grantsGuy1[3], endTimeSolidity, "endtime is wrong");
		assert.equal(grantsGuy1[4], 0, "AmountWithdraw is wrong");
	});


	var areAlmostEquals = function(a,b,precision) {
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


