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


contract('Deposit', function(accounts) {
	// account setting ----------------------------------------------------------------------
	var admin = accounts[0];
	var spender1 = accounts[1];
	var spender2 = accounts[2];
	var vester1 = accounts[3];
	var vester2 = accounts[4];

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
	});

	it("simple deposit", async function() {
		// spender1 deposit
		await testToken.approve(vestingERC20.address, spender1Supply, {from: spender1});
		var r = await vestingERC20.deposit(testToken.address, spender1Supply, {from: spender1});
		
		assert.equal(r.logs[0].event, 'Deposit', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(spender1Supply), "amount is wrong");
		assert(r.logs[0].args.balance.equals(spender1Supply), "balance is wrong");

		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(spender1Supply), "spender1SupplyOnContract is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken.address, spender2)).equals(0), "spender2SupplyOnContract is wrong");
	});

	it("deposit without approval", async function() {		
		// 0 approval
		await expectThrow(vestingERC20.deposit(testToken.address, spender1Supply, {from: spender1}));
		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(0), "spender1SupplyOnContract is wrong");

		// appoval from someone else
		await testToken.approve(vestingERC20.address, spender2Supply, {from: spender2});
		await expectThrow(vestingERC20.deposit(testToken.address, spender2Supply, {from: spender1}));
		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(0), "spender1SupplyOnContract is wrong");

		// appoval for another token
		await testToken2.approve(vestingERC20.address, spender1Supply, {from: spender1});
		await expectThrow(vestingERC20.deposit(testToken.address, spender1Supply, {from: spender1}));
		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(0), "spender1SupplyOnContract is wrong");

		// not enough approval
		await testToken.approve(vestingERC20.address, spender1Supply.minus(1), {from: spender1});
		await expectThrow(vestingERC20.deposit(testToken.address, spender1Supply, {from: spender1}));
		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(0), "spender1SupplyOnContract is wrong");
	});


	it("double deposit one approval", async function() {		
		await testToken.approve(vestingERC20.address, spender1Supply, {from: spender1});

		var r = await vestingERC20.deposit(testToken.address, spender1Supply.div(2), {from: spender1});
		assert.equal(r.logs[0].event, 'Deposit', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(spender1Supply.div(2)), "amount is wrong");
		assert(r.logs[0].args.balance.equals(spender1Supply.div(2)), "balance is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(spender1Supply.div(2)), "spender1SupplyOnContract is wrong");


		r = await vestingERC20.deposit(testToken.address, spender1Supply.div(2), {from: spender1});
		assert.equal(r.logs[0].event, 'Deposit', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(spender1Supply.div(2)), "amount is wrong");
		assert(r.logs[0].args.balance.equals(spender1Supply), "balance is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(spender1Supply), "spender1SupplyOnContract is wrong");

	});



	it("two deposit from different tokens with two users", async function() {		
		await testToken.approve(vestingERC20.address, spender1Supply, {from: spender1});
		await testToken2.approve(vestingERC20.address, spender1Supply, {from: spender1});

		var r = await vestingERC20.deposit(testToken.address, spender1Supply, {from: spender1});
		assert.equal(r.logs[0].event, 'Deposit', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(spender1Supply), "amount is wrong");
		assert(r.logs[0].args.balance.equals(spender1Supply), "balance is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken.address, spender1)).equals(spender1Supply), "spender1SupplyOnContract is wrong");

		var r = await vestingERC20.deposit(testToken2.address, spender1Supply, {from: spender1});
		assert.equal(r.logs[0].event, 'Deposit', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken2.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(spender1Supply), "amount is wrong");
		assert(r.logs[0].args.balance.equals(spender1Supply), "balance is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken2.address, spender1)).equals(spender1Supply), "spender1SupplyOnContract is wrong");


		await testToken.approve(vestingERC20.address, spender2Supply, {from: spender2});
		await testToken2.approve(vestingERC20.address, spender2Supply, {from: spender2});

		var r = await vestingERC20.deposit(testToken.address, spender2Supply, {from: spender2});
		assert.equal(r.logs[0].event, 'Deposit', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(spender2Supply), "amount is wrong");
		assert(r.logs[0].args.balance.equals(spender2Supply), "balance is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken.address, spender2)).equals(spender2Supply), "spender2SupplyOnContract is wrong");

		var r = await vestingERC20.deposit(testToken2.address, spender2Supply, {from: spender2});
		assert.equal(r.logs[0].event, 'Deposit', "event is wrong");
		assert.equal(r.logs[0].args.token, testToken2.address, "token is wrong");
		assert(r.logs[0].args.amount.equals(spender2Supply), "amount is wrong");
		assert(r.logs[0].args.balance.equals(spender2Supply), "balance is wrong");
		assert((await vestingERC20.getContractBalance.call(testToken2.address, spender2)).equals(spender2Supply), "spender2SupplyOnContract is wrong");
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


