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


contract('Grant', function(accounts) {
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

	it("simple grant", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.vestedAmount.equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.balanceDepositPerPersonPerToken.call(testToken.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

	});

	it("Grant Vesting for himself", async function() {
		// grantVesting by owner
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, spender1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.vestedAmount.equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, spender1, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.balanceDepositPerPersonPerToken.call(testToken.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender1, spender1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");
	});

	it("Grant Vesting with wrong arguments", async function() {
		var grantAmount = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp;
		var cliffPeriod = 100*dayInsecond;
		var grantPeriod = 1000*dayInsecond;

		// grantVesting with _token == 0
		await expectThrow(vestingERC20.grantVesting(0,
														vester1, 
														grantAmount,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: spender1}));

		// grantVesting with _to == 0
		await expectThrow(vestingERC20.grantVesting(testToken.address,
														0, 
														grantAmount,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: spender1}));

		// grantVesting with vestedAmount 0
		await expectThrow(vestingERC20.grantVesting(testToken.address,
														vester1, 
														0,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: spender1}));

		// grantVesting with cliffPeriod > grantPeriod
		await expectThrow(vestingERC20.grantVesting(testToken.address,
														vester1, 
													grantAmount,
													startTimeSolidity,
													cliffPeriod,
													grantPeriod,
													{from: spender1}));

		// create one for vester1 for next test
		var r = await vestingERC20.grantVesting(testToken.address,
														vester1, 
														grantAmount,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: spender1});


		// grantVesting to someone with already a grant
		await expectThrow(vestingERC20.grantVesting(testToken.address,
														vester1, 
														grantAmount,    
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: spender1}));


		// create one huge for next test
		var r = await vestingERC20.grantVesting(testToken.address,
														vester2, 
														spender2Supply - grantAmount - 1,
								            startTimeSolidity,
								            grantPeriod,
								            cliffPeriod,
								            {from: spender2});

		// grantVesting with vestedAmount > token available
		await expectThrow(vestingERC20.grantVesting(testToken.address,
												vester3, 
												grantAmount,    
						            startTimeSolidity,
						            grantPeriod,
						            cliffPeriod,
						            {from: spender2}));
	});


	it("grant vesting with same token and same from to different vesters", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var grantSpender1toVester2 = (new BigNumber(10).pow(decimals)).mul(5000);

		var startTimeSolidity = currentTimeStamp;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant vester1
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.vestedAmount.equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.balanceDepositPerPersonPerToken.call(testToken.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

		// create the grant vester2
		var r = await vestingERC20.grantVesting(testToken.address, vester2, grantSpender1toVester2, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.vestedAmount.equals(grantSpender1toVester2), "vestedAmount is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester2, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.balanceDepositPerPersonPerToken.call(testToken.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1).minus(grantSpender1toVester2)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender1, vester2);
		assert(grantsS1toV1[0].equals(grantSpender1toVester2), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

	});

	it("grant vesting to the same vester but different token", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var grantSpender1toVester1Token2 = (new BigNumber(10).pow(decimals)).mul(5000);

		var startTimeSolidity = currentTimeStamp;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant token 1
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.vestedAmount.equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.balanceDepositPerPersonPerToken.call(testToken.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

		// create the grant token 2
		var r = await vestingERC20.grantVesting(testToken2.address, vester1, grantSpender1toVester1Token2, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken2.address, "token is wrong");
		assert(r.logs[0].args.vestedAmount.equals(grantSpender1toVester1Token2), "vestedAmount is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.balanceDepositPerPersonPerToken.call(testToken2.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1Token2)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken2.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1Token2), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

	});

	it("grant vesting to someone with a vesting same token but from other spender", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var grantSpender1toVester1fromSpender2 = (new BigNumber(10).pow(decimals)).mul(5000);

		var startTimeSolidity = currentTimeStamp;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant token 1
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.vestedAmount.equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.balanceDepositPerPersonPerToken.call(testToken.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

		// create the grant token 2
		var r = await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1fromSpender2, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender2});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.vestedAmount.equals(grantSpender1toVester1fromSpender2), "vestedAmount is wrong");
		assert.equal(r.logs[0].args.from, spender2, "from is wrong");
		assert.equal(r.logs[0].args.to, vester1, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.balanceDepositPerPersonPerToken.call(testToken.address, spender2)).equals(spender2Supply.minus(grantSpender1toVester1fromSpender2)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender2, vester1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1fromSpender2), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], startTimeSolidity, "startTime is wrong");
		assert.equal(grantsS1toV1[2], startTimeSolidity+cliffPeriodS1V1, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], startTimeSolidity+grantPeriodS1V1, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

	});


	it("grant to withdraw balance deposit", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = 0;
		var cliffPeriodS1V1 = 0;
		var grantPeriodS1V1 = 0;

		// create the grant
		var r = await vestingERC20.grantVesting(testToken.address, spender1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		assert.equal(r.logs[0].event, 'NewGrant', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.vestedAmount.equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(r.logs[0].args.from, spender1, "from is wrong");
		assert.equal(r.logs[0].args.to, spender1, "to is wrong");
		assert(r.logs[0].args.startTime.equals(startTimeSolidity), "startTime is wrong");
		assert(r.logs[0].args.cliffTime.equals(startTimeSolidity+cliffPeriodS1V1), "cliffTime is wrong");
		assert(r.logs[0].args.endTime.equals(startTimeSolidity+grantPeriodS1V1), "endTime is wrong");

		assert((await vestingERC20.balanceDepositPerPersonPerToken.call(testToken.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantsPerVesterPerSpenderPerToken.call(testToken.address, spender1, spender1);
		assert(grantsS1toV1[0].equals(grantSpender1toVester1), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], 0, "startTime is wrong");
		assert.equal(grantsS1toV1[2], 0, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], 0, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

		assert((await vestingERC20.getBalanceVesting.call(testToken.address, spender1, spender1)).equals(grantSpender1toVester1), "spender1SupplyOnContract is wrong");

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


