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


contract('Grant Token', function(accounts) {
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


	it("Grant Vesting", async function() {
		// grantVesting by owner
		var startTimeSolidity = currentTimeStamp;
		var cliffPeriod = 100*dayInsecond;
		var grantPeriod = 1000*dayInsecond;

		var r = await vestingERC20.grantVesting(guy1, 
											grantToGuy1,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: admin});

		// event NewGrant(to, amountInitial, startTime, cliffTime, endTime)
		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.to, guy1, "to is wrong");
		assert(r.logs[0].args.amountInitial.equals(grantToGuy1), "amountInitial is wrong");
		assert.equal(r.logs[0].args.startTime, startTimeSolidity, "startTime is wrong");
		assert.equal(r.logs[0].args.cliffTime, startTimeSolidity+cliffPeriod, "cliffTime is wrong");
		assert.equal(r.logs[0].args.endTime, startTimeSolidity+grantPeriod, "endTime is wrong");


		assert(grantToGuy1.equals(await vestingERC20.amountTotalLocked.call()), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy1);
		assert(grantsGuy1[0].equals(grantToGuy1), "amountInitial is wrong");
		assert.equal(grantsGuy1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsGuy1[2], startTimeSolidity+cliffPeriod, "clifTime is wrong");
		assert.equal(grantsGuy1[3], startTimeSolidity+grantPeriod, "endtime is wrong");
		assert.equal(grantsGuy1[4], 0, "AmountWithdraw is wrong");

	});


	it("Grant Vesting not by admin", async function() {
		var startTimeSolidity = currentTimeStamp;
		var cliffPeriod = 100*dayInsecond;
		var grantPeriod = 1000*dayInsecond;

		// grantVesting by guy1 to guy1
		await expectThrow(vestingERC20.grantVesting(guy1, 
											grantToGuy1,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: guy1}));

		// grantVesting by guy2 to guy1
		await expectThrow(vestingERC20.grantVesting(guy1, 
											grantToGuy1,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: guy2}));
	});

/*
	it("Grant Vesting with wrong arguments", async function() {
		var startTimeSolidity = currentTimeStamp;
		var cliffPeriod = 100*dayInsecond;
		var grantPeriod = 1000*dayInsecond;

		// grantVesting with _to == 0
		await expectThrow(vestingERC20.grantVesting(0, 
														grantToGuy1,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: admin}));

		// grantVesting with amountInitial 0
		await expectThrow(vestingERC20.grantVesting(guy1, 
														0,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: admin}));


		// grantVesting with startTime >= endTime
		await expectThrow(vestingERC20.grantVesting(guy1, 
													grantToGuy1,
													startTimeSolidity,
													cliffPeriod,
													startTimeSolidity,
													{from: admin}));

		// grantVesting with cliffTime >= endTime
		await expectThrow(vestingERC20.grantVesting(guy1, 
													grantToGuy1,
													startTimeSolidity,
													grantPeriod,
													cliffPeriod,
													{from: admin}));

		// grantVesting with startTime >= cliffTime 
		await expectThrow(vestingERC20.grantVesting(guy1, 
													grantToGuy1,
													cliffPeriod,
													startTimeSolidity,
													grantPeriod,
													{from: admin}));

		// create one for guy1 for next test
		var r = await vestingERC20.grantVesting(guy1, 
											grantToGuy1,    
								            startTimeSolidity,
								            cliffPeriod,
								            grantPeriod,
								            {from: admin});


		// grantVesting to someone with already a grant
		await expectThrow(vestingERC20.grantVesting(guy1, 
														grantToGuy1,    
								            startTimeSolidity,
								            cliffPeriod,
								            grantPeriod,
								            {from: admin}));


		// create one huge for next test
		var r = await vestingERC20.grantVesting(guy2, 
														amountTokenSupply - grantToGuy1 - 1,
								            startTimeSolidity,
								            cliffPeriod,
								            grantPeriod,
								            {from: admin});

		// grantVesting with amountInitial > token available
		await expectThrow(vestingERC20.grantVesting(guy3, 
												grantToGuy1,    
						            startTimeSolidity,
						            cliffPeriod,
						            grantPeriod,
						            {from: admin}));
	});
*/


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


