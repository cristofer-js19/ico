// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract GFTCoin is ERC20 {
    constructor(address founder) ERC20("GFT Coin", "GFTC") {
        _mint(founder, 500000 * 10 ** 6);
        _mint(address(this), 500000 * 10 ** 6);
    }

    function decimals() public view virtual override returns (uint8) {
        return 0;
    }
}

contract GFTCoinICO is GFTCoin {
    address payable public beneficiary;
    uint256 public maxInvestment = 5 ether;
    uint256 public minInvestment = 0.1 ether;
    uint256 public tokenPrice = 0.001 ether;
    uint256 public hardCap = 300 ether;
    uint256 public raisedAmount;
    uint256 public saleStart = block.timestamp;
    uint256 public saleEnd = block.timestamp + 1 weeks;
    uint256 public tradeStart = saleEnd + 1 weeks;

    enum State {
        beforeStart,
        afterEnd,
        running,
        stop
    }

    error ICOnotRunning();
    error ICOoutOfRangeInvesment();
    error ICOhardCapReached();
    error TradeDoesNotStart();
    error TransferBeneficiaryFailure();

    event InvestmentReceived(
        address indexed investor,
        uint256 value,
        uint256 tokens
    );

    // uint256 public GFT_RATE = 1000 * 10 ** 6;

    constructor(address payable _beneficiary) GFTCoin(msg.sender) {
        beneficiary = _beneficiary;
    }

    receive() external payable {
        invest();
    }

    modifier checkTradeStart() {
        if (msg.sender != address(this)) {
            require(block.timestamp > tradeStart, TradeDoesNotStart());
        }
        _;
    }

    function getCurrentState() public view returns (State) {
        if (block.timestamp < saleStart) {
            return State.beforeStart;
        } else if (block.timestamp >= saleStart && block.timestamp <= saleEnd) {
            return State.running;
        } else {
            return State.afterEnd;
        }
    }

    function invest() public payable returns (bool) {
        require(getCurrentState() == State.running, ICOnotRunning());
        require(
            msg.value >= minInvestment && msg.value <= maxInvestment,
            ICOoutOfRangeInvesment()
        );
        require(raisedAmount + msg.value <= hardCap, ICOhardCapReached());
        // uint256 gftCoinAmount = (msg.value * GFT_RATE) / 1 ether;
        uint256 gftCoinAmount = msg.value / tokenPrice;
        raisedAmount += msg.value;

        ERC20(address(this)).transfer(msg.sender, gftCoinAmount);

        (bool ok, ) = beneficiary.call{value: msg.value}("");
        require(ok, TransferBeneficiaryFailure());

        emit InvestmentReceived(msg.sender, msg.value, gftCoinAmount);

        return true;
    }

    function transfer(
        address to,
        uint256 value
    ) public virtual override checkTradeStart returns (bool) {
        return super.transfer(to, value);
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public virtual override checkTradeStart returns (bool) {
        return super.transferFrom(from, to, value);
    }
}
