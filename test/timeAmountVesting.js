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


contract('Timing amount Vesting', function(accounts) {
	// account setting ----------------------------------------------------------------------
	var admin = accounts[0];
	var spender1 = accounts[1];
	var vester1 = accounts[3];

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

		// create vesting
		vestingERC20 = await VestingERC20.new(testToken.address);

		// time
		currentTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

		// send token to the futur spenders
		await testToken.transfer(spender1, spender1Supply, {from: admin});

		// deposit spender1
		await testToken.approve(vestingERC20.address, spender1Supply, {from: spender1});
		var r = await vestingERC20.deposit(testToken.address, spender1Supply, {from: spender1});
	});

	it("check amount throug time", async function() {
		// grantVesting by owner
		var grantSpender1toVester1 = (new BigNumber(10).pow(decimals)).mul(1000);
		var startTimeSolidity = currentTimeStamp;
		var cliffPeriod = 200*dayInsecond;
		var grantPeriod = 1000*dayInsecond;


		await vestingERC20.grantVesting(testToken.address, vester1, grantSpender1toVester1, 
											startTimeSolidity, grantPeriod, cliffPeriod,
											 {from: spender1});

		// array [[days,amountReleased]]
		var arrayTest = [[1,0],[5,0],[10,0],[50,0],[100,0],[199,0],[200,200],[500,500],[999,999],[1000,1000],[1001,1000]];;

		var lastTime = 0;
		for(var ind=0;ind<arrayTest.length;ind++) {
			var a = arrayTest[ind];			
			addsDayOnEVM(a[0]-lastTime);
			// console.log(a[0] + " => "+await vestingERC20.getBalanceVesting(testToken.address, spender1, vester1))
			assert( areAlmostEquals(await vestingERC20.getBalanceVesting(testToken.address, spender1, vester1), (new BigNumber(10).pow(decimals)).mul(a[1])), a[0]+" getTokenAmountReleased wrong ");
			lastTime = a[0];
		}

	});


	var areAlmostEquals = function(a,b,precision) {
		if(a.lt(b)) {
			var temp = a;
			a = b;
			b = temp;
		}
		precision = precision ? precision : 0.00001;
		return a.sub(b).lte(a.mul(precision));
	}

	var addsDayOnEVM = async function(days) {
		var daysInsecond = 60 * 60 * 24 * days 
		var currentBlockTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
		await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [daysInsecond], id: 0});
		await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
	}
});


