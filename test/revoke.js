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


contract('Revoke', function(accounts) {
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

	it("simple revoke", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.createVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(testToken.address, vester1, {from: spender1});


		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[0].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert.equal(r.logs[0].args.amount, 0, "amount is wrong");

		// event GrantRevoked(from, to, token)
		assert.equal(r.logs[1].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[1].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[1].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[1].args.token, testToken.address, "token is wrong");

		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(spender1Supply), "spender1SupplyOnContract is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken.address, vester1)).equals(0), "vester1 is wrong");

		var grantsS1toV1 = await vestingERC20.grantPerTokenGranterVester.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(0), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], 0, "startTime is wrong");
		assert.equal(grantsS1toV1[2], 0, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], 0, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

		// revoke grant before cliff -> nothing to withdrawl during the revoking
		assert.equal(await testToken.balanceOf.call(vester1), 0, "vester1 balance is wrong");

	});

	it("Revoke Vesting with wrong arguments", async function() {

		// revokeVesting to someone with no grant
		await expectThrow(vestingERC20.revokeVesting(testToken.address, vester1, {from: spender1}));


		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.createVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		// revokeVesting with _to == 0
		await expectThrow(vestingERC20.revokeVesting(testToken.address, 0, {from: spender1}));

		// revokeVesting with _token == 0
		await expectThrow(vestingERC20.revokeVesting(0, vester1, {from: spender1}));

		// revokeVesting by spender2 from spender1
		await expectThrow(vestingERC20.revokeVesting(testToken.address, vester1, {from: spender2}));

		// revokeVesting by spender1 to vester1 from vester1 
		await expectThrow(vestingERC20.revokeVesting(testToken.address, vester1, {from: vester1}));
	});


	it("revoke grant not started", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp + 100*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.createVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(testToken.address, vester1, {from: spender1});


		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[0].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert.equal(r.logs[0].args.amount, 0, "amount is wrong");

		// event GrantRevoked(from, to, token)
		assert.equal(r.logs[1].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[1].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[1].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[1].args.token, testToken.address, "token is wrong");

		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(spender1Supply), "spender1SupplyOnContract is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken.address, vester1)).equals(0), "vester1 is wrong");

		var grantsS1toV1 = await vestingERC20.grantPerTokenGranterVester.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(0), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], 0, "startTime is wrong");
		assert.equal(grantsS1toV1[2], 0, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], 0, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

		// revoke grant before cliff -> nothing to withdrawl during the revoking
		assert.equal(await testToken.balanceOf.call(vester1), 0, "vester1 balance is wrong");

	});



	it("revoke grant finished", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 2000*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.createVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(testToken.address, vester1, {from: spender1});

		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[0].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(grantSpender1toVester1), "amount is wrong");

		// event GrantRevoked(from, to, token)
		assert.equal(r.logs[1].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[1].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[1].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[1].args.token, testToken.address, "token is wrong");

		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(spender1Supply.minus(grantSpender1toVester1)), "spender1SupplyOnContract is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken.address, vester1)).equals(grantSpender1toVester1), "vester1 is wrong");

		var grantsS1toV1 = await vestingERC20.grantPerTokenGranterVester.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(0), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], 0, "startTime is wrong");
		assert.equal(grantsS1toV1[2], 0, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], 0, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

		// revoke grant before cliff -> nothing to withdrawl during the revoking
		assert((await testToken.balanceOf.call(vester1)).equals(0), "vester1 balance is wrong");

	});

	it("revoke grant after cliff", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 500*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.createVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(testToken.address, vester1, {from: spender1});

		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[0].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(areAlmostEquals(r.logs[0].args.amount, grantSpender1toVester1.div(2)), "amount is wrong");

		// event GrantRevoked(from, to, token)
		assert.equal(r.logs[1].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[1].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[1].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[1].args.token, testToken.address, "token is wrong");

		assert(areAlmostEquals(await vestingERC20.getContractBalance.call(testToken.address, spender1),spender1Supply.minus(grantSpender1toVester1.div(2))), "spender1SupplyOnContract is wrong");
		assert(areAlmostEquals(await vestingERC20.getContractBalance.call(testToken.address, vester1),grantSpender1toVester1.div(2)), "vester1 is wrong");

		var grantsS1toV1 = await vestingERC20.grantPerTokenGranterVester.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(0), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], 0, "startTime is wrong");
		assert.equal(grantsS1toV1[2], 0, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], 0, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

		// revoke grant before cliff -> nothing to withdrawl during the revoking
		assert(areAlmostEquals(await testToken.balanceOf.call(vester1),0), "vester1 balance is wrong");
	});

	it("revoke grant after cliff and after a withdraw", async function() {
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp - 500*dayInsecond;
		var cliffPeriodS1V1 = 200*dayInsecond;
		var grantPeriodS1V1 = 1000*dayInsecond;

		// create the grant
		var r = await vestingERC20.createVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriodS1V1, cliffPeriodS1V1,
											 {from: spender1});

		// withdraw by vester
		var r = await vestingERC20.releaseGrant(testToken.address, spender1, false,{from: vester1});

		// revokeVesting by owner
		var r = await vestingERC20.revokeVesting(testToken.address, vester1, {from: spender1});

		// event TokenReleased(address token, address from, address to, uint amount)
		assert.equal(r.logs[0].event, 'TokenReleased', "event is wrong");
		assert.equal(r.logs[0].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[0].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		// almost zero to withdraw
		assert(areAlmostEquals(r.logs[0].args.amount.add(grantSpender1toVester1), grantSpender1toVester1), "amount is wrong");
		assert(areAlmostEquals(await vestingERC20.getContractBalance.call(testToken.address, vester1),grantSpender1toVester1.div(2)), "vester1 is wrong");

		// event GrantRevoked(from, to, token)
		assert.equal(r.logs[1].event, 'GrantRevoked', "event is wrong");
		assert.equal(r.logs[1].args.granter, spender1, "from is wrong");
		assert.equal(r.logs[1].args.vester, vester1, "to is wrong");
		assert.equal(r.logs[1].args.token, testToken.address, "token is wrong");

		assert(areAlmostEquals(await vestingERC20.getContractBalance.call(testToken.address, spender1),spender1Supply.minus(grantSpender1toVester1.div(2))), "spender1SupplyOnContract is wrong");

		var grantsS1toV1 = await vestingERC20.grantPerTokenGranterVester.call(testToken.address, spender1, vester1);
		assert(grantsS1toV1[0].equals(0), "vestedAmount is wrong");
		assert.equal(grantsS1toV1[1], 0, "startTime is wrong");
		assert.equal(grantsS1toV1[2], 0, "cliffTime is wrong");
		assert.equal(grantsS1toV1[3], 0, "endtime is wrong");
		assert.equal(grantsS1toV1[4], 0, "withdrawnAmount is wrong");

		// revoke grant before cliff -> nothing to withdrawl during the revoking
		assert(areAlmostEquals(await testToken.balanceOf.call(vester1),0), "vester1 balance is wrong");
	});

	var areAlmostEquals = function(a,b,precision) {
		if(a.lt(b)) {
			var temp = a;
			a = b;
			b = temp;
		}
		precision = precision ? precision : 0.00001;
		return a.sub(b).lte(a.mul(precision)) || a.equals(b);
	}

	var addsDayOnEVM = async function(days) {
		var daysInsecond = 60 * 60 * 24 * days 
		var currentBlockTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
		await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [daysInsecond], id: 0});
		await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
	}
});


