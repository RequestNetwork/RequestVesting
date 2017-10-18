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


contract('Revoke Vesting', function(accounts) {
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

	it("Revoking Vesting before cliff", async function() {
		// grantVesting by owner
		var startTimeSolidity = currentTimeStamp;
		var cliffTimeSolidity = startTimeSolidity + 100*dayInsecond;
		var endTimeSolidity = startTimeSolidity + 1000*dayInsecond;


		// create the vesting to delete
		var r = await vestingERC20.grantVesting(guy1, 
												grantToGuy1,
												startTimeSolidity,
												cliffTimeSolidity,
												endTimeSolidity,
												{from: admin});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(guy1, {from: admin});


		// event GrantRevoked(to)
		assert.equal(r.logs[0].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[0].args.to, guy1, "to is wrong");

		assert((await vestingERC20.amountTotalLocked.call()).equals(0), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy1);
		assert.equal(grantsGuy1[0], 0, "amountInitial is wrong");
		assert.equal(grantsGuy1[1], 0, "startTime is wrong");
		assert.equal(grantsGuy1[2], 0, "clifTime is wrong");
		assert.equal(grantsGuy1[3], 0, "endtime is wrong");
		assert.equal(grantsGuy1[4], 0, "AmountWithdraw is wrong");

		// revoke grant before cliff -> nothing to withdrawl during the revoking
		assert.equal(await testToken.balanceOf.call(guy1), 0, "guy1 balance is wrong");
	});


	it("Revoking Vesting before grant starting", async function() {
		// grantVesting by owner
		var startTimeSolidity = currentTimeStamp + 100*dayInsecond;;
		var cliffTimeSolidity = startTimeSolidity + 100*dayInsecond;
		var endTimeSolidity = startTimeSolidity + 1000*dayInsecond;

		// create the vesting to delete
		var r = await vestingERC20.grantVesting(guy1, 
														grantToGuy1,
														startTimeSolidity,
														cliffTimeSolidity,
														endTimeSolidity,
														{from: admin});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(guy1, {from: admin});

		// event GrantRevoked(to)
		assert.equal(r.logs[0].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[0].args.to, guy1, "to is wrong");

		assert((await vestingERC20.amountTotalLocked.call()).equals(0), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy1);
		assert.equal(grantsGuy1[0], 0, "amountInitial is wrong");
		assert.equal(grantsGuy1[1], 0, "startTime is wrong");
		assert.equal(grantsGuy1[2], 0, "clifTime is wrong");
		assert.equal(grantsGuy1[3], 0, "endtime is wrong");
		assert.equal(grantsGuy1[4], 0, "AmountWithdraw is wrong");

		// revoke grant before start -> nothing to withdrawl during the revoking
		assert((await testToken.balanceOf.call(guy1)).equals(0), "guy1 balance is wrong");
	});

	it("Revoking Vesting after cliff", async function() {
		// grantVesting by owner
		var startTimeSolidity = currentTimeStamp - 100*dayInsecond;;
		var cliffTimeSolidity = currentTimeStamp - 10*dayInsecond;
		var endTimeSolidity = startTimeSolidity + 1000*dayInsecond;


		// create the vesting to delete
		var r = await vestingERC20.grantVesting(guy1, 
												grantToGuy1,
												startTimeSolidity,
												cliffTimeSolidity,
												endTimeSolidity,
												{from: admin});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(guy1, {from: admin});

		// event GrantRevoked(to)
		assert.equal(r.logs[0].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[0].args.to, guy1, "to is wrong");

		assert((await vestingERC20.amountTotalLocked.call()).equals(0), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy1);
		assert.equal(grantsGuy1[0], 0, "amountInitial is wrong");
		assert.equal(grantsGuy1[1], 0, "startTime is wrong");
		assert.equal(grantsGuy1[2], 0, "clifTime is wrong");
		assert.equal(grantsGuy1[3], 0, "endtime is wrong");
		assert.equal(grantsGuy1[4], 0, "AmountWithdraw is wrong");

		// revoke grant after cliff -> withdrawl during the revoking
		assert(areAlmostEquals(await testToken.balanceOf.call(guy1), grantToGuy1.mul(10).div(100)), "guy1 balance is wrong");
	});


	it("Revoking Vesting after finish", async function() {
		// grantVesting by owner
		var startTimeSolidity = currentTimeStamp - 100*dayInsecond;;
		var cliffTimeSolidity = currentTimeStamp - 90*dayInsecond;
		var endTimeSolidity = startTimeSolidity + 99*dayInsecond;

		// create the vesting to delete
		var r = await vestingERC20.grantVesting(guy1, 
														grantToGuy1,
														startTimeSolidity,
														cliffTimeSolidity,
														endTimeSolidity,
														{from: admin});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(guy1, {from: admin});

		// event GrantRevoked(to)
		assert.equal(r.logs[0].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[0].args.to, guy1, "to is wrong");

		assert((await vestingERC20.amountTotalLocked.call()).equals(0), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy1);
		assert.equal(grantsGuy1[0], 0, "amountInitial is wrong");
		assert.equal(grantsGuy1[1], 0, "startTime is wrong");
		assert.equal(grantsGuy1[2], 0, "clifTime is wrong");
		assert.equal(grantsGuy1[3], 0, "endtime is wrong");
		assert.equal(grantsGuy1[4], 0, "AmountWithdraw is wrong");

		// revoke grant after finish -> withdrawl during the revoking
		assert((await testToken.balanceOf.call(guy1)).equals(grantToGuy1), "guy1 balance is wrong");
	});


	it("Revoking Vesting after withdraw", async function() {
		// grantVesting by owner
		var startTimeSolidity = currentTimeStamp - 100*dayInsecond;;
		var cliffTimeSolidity = currentTimeStamp - 10*dayInsecond;
		var endTimeSolidity = startTimeSolidity + 101*dayInsecond;


		// create the vesting to delete
		var r = await vestingERC20.grantVesting(guy1, 
														grantToGuy1,
														startTimeSolidity,
														cliffTimeSolidity,
														endTimeSolidity,
														{from: admin});


		var r = await vestingERC20.withdraw({from: guy1});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(guy1, {from: admin});

		// event GrantRevoked(to)
		assert.equal(r.logs[0].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[0].args.to, guy1, "to is wrong");

		assert((await vestingERC20.amountTotalLocked.call()).equals(0), "amountTotalLocked is wrong");

		var grantsGuy1 = await vestingERC20.grants.call(guy1);
		assert.equal(grantsGuy1[0], 0, "amountInitial is wrong");
		assert.equal(grantsGuy1[1], 0, "startTime is wrong");
		assert.equal(grantsGuy1[2], 0, "clifTime is wrong");
		assert.equal(grantsGuy1[3], 0, "endtime is wrong");
		assert.equal(grantsGuy1[4], 0, "AmountWithdraw is wrong");

		// revoke grant after cliff -> withdrawl during the revoking
		assert(areAlmostEquals(await testToken.balanceOf.call(guy1), grantToGuy1.mul(99).div(100)), "guy1 balance is wrong");
	});

	it("Revoking Vesting impossible", async function() {
		// grantVesting by owner
		var startTimeSolidity = currentTimeStamp;
		var cliffTimeSolidity = startTimeSolidity + 100*dayInsecond;
		var endTimeSolidity = startTimeSolidity + 1000*dayInsecond;

		// revokeVesting to someone with no grant
		await expectThrow(vestingERC20.revokeVesting(guy1, {from: guy1}));

		// create the vesting to delete
		var r = await vestingERC20.grantVesting(guy1, 
														grantToGuy1,
														startTimeSolidity,
														cliffTimeSolidity,
														endTimeSolidity,
														{from: admin});

		// revokeVesting by guy1 to guy1
		await expectThrow(vestingERC20.revokeVesting(guy1, {from: guy1}));
		// revokeVesting by guy2 to guy1
		await expectThrow(vestingERC20.revokeVesting(guy1, {from: guy2}));
		// revokeVesting with _to == 0
		await expectThrow(vestingERC20.revokeVesting(0, {from: admin}));
	});


	var areAlmostEquals = function(a,b,precision) {
		if(a.lt(b)) {
			var temp = a;
			a = b;
			b = temp;
		}
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


