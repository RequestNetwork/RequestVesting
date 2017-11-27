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
    const revert = error.message.search('revert') >= 0;
    assert(
      invalidOpcode || invalidJump || outOfGas || revert,
      "Expected throw, got '" + error + "' instead",
    );
    return;
  }
  assert.fail('Expected throw not received');
};


contract('releaseGrant with withdraw', function(accounts) {
	// account setting ----------------------------------------------------------------------
	var admin = accounts[0];
	var spender1 = accounts[1];
	var spender2 = accounts[2];
	var vester1 = accounts[3];
	var vester2 = accounts[4];
	var vester3 = accounts[5];

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


	// variable to host contracts ------------------------------------------------------------
	var vestingERC20;
	var testToken;


	beforeEach(async () => {
		// create token
		testToken = await TestToken.new(amountTokenSupply);

		testToken2 = await TestToken.new(amountTokenSupply);

		// create vesting
		vestingERC20 = await VestingERC20.new(testToken.address);

		// time
		currentTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

		// send token to the futur spenders
		await testToken.transfer(spender1, spender1Supply, {from: admin});
		await testToken.transfer(spender2, spender2Supply, {from: admin});

		// send token to the futur spenders
		await testToken2.transfer(spender1, spender1Supply, {from: admin});
		await testToken2.transfer(spender2, spender2Supply, {from: admin});

		// deposit spender1
		await testToken.approve(vestingERC20.address, spender1Supply, {from: spender1});
		var r = await vestingERC20.deposit(testToken.address, spender1Supply, {from: spender1});
		await testToken2.approve(vestingERC20.address, spender1Supply, {from: spender1});
		var r = await vestingERC20.deposit(testToken2.address, spender1Supply, {from: spender1});

		// deposit spender2
		await testToken.approve(vestingERC20.address, spender2Supply, {from: spender2});
		var r = await vestingERC20.deposit(testToken.address, spender2Supply, {from: spender2});	
	});

	it("simple releaseGrant after cliff", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 250*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		var r = await vestingERC20.releaseGrant(testToken.address, spender1, true, {from: vester1});

		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(areAlmostEquals(r.logs[0].args.amount, grantSpender1toVester1.div(4)), "amount is wrong");

		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, spender1),spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");
		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, vester1),0), "vester1 balance is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert(areAlmostEquals(grantsS1toV1[4], grantSpender1toVester1.div(4)), "withdrawnAmount is wrong");

		assert(areAlmostEquals(await testToken.balanceOf.call(vester1),grantSpender1toVester1.div(4)), "vester1 balance is wrong");

	});

	it("releaseGrant with token = 0", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 250*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		await vestingERC20.releaseGrant(0, spender1, false, {from: vester1});

		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, spender1),spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");
		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, vester1),0), "vester1 balance is wrong");

		assert(areAlmostEquals(await testToken.balanceOf.call(vester1),0), "vester1 balance is wrong");
	});


	it("releaseGrant with from = 0", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 250*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		var r = await vestingERC20.releaseGrant(testToken.address, 0, false, {from: vester1});

		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.from, 0, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(areAlmostEquals(r.logs[0].args.amount, 0), "amount is wrong");

		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, spender1),spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");
		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, vester1),0), "vester1 balance is wrong");

		assert(areAlmostEquals(await testToken.balanceOf.call(vester1),0), "vester1 balance is wrong");
	});


	it("releaseGrant without grant", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 250*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		var r = await vestingERC20.releaseGrant(testToken2.address, spender1, false, {from: vester1});

		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken2.address, "token is wrong");
		assert(areAlmostEquals(r.logs[0].args.amount, 0), "amount is wrong");

		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, spender1),spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");
		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, vester1),0), "vester1 balance is wrong");

		assert(areAlmostEquals(await testToken2.balanceOf.call(vester1),0), "vester1 balance is wrong");
	});


	it("releaseGrant of every tokens => delete grant", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 2000*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		// first releaseGrant to empty grant
		var r = await vestingERC20.releaseGrant(testToken.address, spender1, true, {from: vester1});

		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(areAlmostEquals(r.logs[0].args.amount, grantSpender1toVester1), "amount is wrong");


		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(0), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], 0, "startTime is wrong");
		assert.equal(grantsS1toV1[2], 0, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], 0, "endtime is wrong");
		assert(areAlmostEquals(grantsS1toV1[4], 0), "withdrawnAmount is wrong");


		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, spender1),spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");
		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, vester1),0), "vester1 balance is wrong");

		assert(areAlmostEquals(await testToken.balanceOf.call(vester1),grantSpender1toVester1), "vester1 balance is wrong");
	});

	it("releaseGrant from address with empty token grant", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 2000*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		// first releaseGrant to empty grant
		await vestingERC20.releaseGrant(testToken.address, spender1, true, {from: vester1});

		var r = await vestingERC20.releaseGrant(testToken.address, spender1, true, {from: vester1});

		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(areAlmostEquals(r.logs[0].args.amount, 0), "amount is wrong");


		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, spender1),spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");
		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, vester1),0), "vester1 balance is wrong");

		assert(areAlmostEquals(await testToken.balanceOf.call(vester1),grantSpender1toVester1), "vester1 balance is wrong");
	});

	it("releaseGrant from other account", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 2000*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		var r = await vestingERC20.releaseGrant(testToken.address, spender1, true, {from: vester2});

		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester2, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(areAlmostEquals(r.logs[0].args.amount, 0), "amount is wrong");


		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, spender1),spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");
		assert(areAlmostEquals(await vestingERC20.balancePerPersonPerToken.call(testToken.address, vester2),0), "vester2 balance is wrong");

		assert(areAlmostEquals(await testToken.balanceOf.call(vester2),0), "vester2 balance is wrong");
	});

	var areAlmostEquals = function(a,b,precision) {
		if(a.lt(b)) {
			var temp = a;
			a = b;
			b = temp;
		}
		precision = precision ? precision : 0.000001;
		return a.sub(b).lte(a.mul(precision)) || (a.equals(0) && b.equals(0));
	}

	var addsDayOnEVM = async function(days) {
		var daysInsecond = 60 * 60 * 24 * days 
		var currentBlockTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
		await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [daysInsecond], id: 0});
		await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
	}
});


