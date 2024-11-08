import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

describe("GFTCoinICO", () => {
    // Fixture para configurar o deploy inicial e o estado do contrato
    async function deployGFTCoinICOFixture() {
        const [founder, beneficiary, investor1, investor2] = await hre.ethers.getSigners();

        const GFTCoinICO = await hre.ethers.getContractFactory("GFTCoinICO");
        const gftCoinICO = await GFTCoinICO.deploy(beneficiary.address);

        return { gftCoinICO, founder, beneficiary, investor1, investor2 };
    }

    describe("Deployment", () => {
        it("Should initialize with correct parameters", async () => {
            const { gftCoinICO, beneficiary } = await loadFixture(deployGFTCoinICOFixture);
            expect(await gftCoinICO.beneficiary()).to.equal(beneficiary.address);
        });

        it("Should set the correct initial sale and trade times", async () => {
            const { gftCoinICO } = await loadFixture(deployGFTCoinICOFixture);
            const saleStart = await gftCoinICO.saleStart();
            const saleEnd = await gftCoinICO.saleEnd();
            const tradeStart = await gftCoinICO.tradeStart();

            expect(saleEnd).to.be.greaterThan(saleStart);
            expect(tradeStart).to.be.greaterThan(saleEnd);
        });
    });

    describe("Investment Requirements", () => {
        it("Should allow investments within min and max range", async () => {
            const { gftCoinICO, investor1, investor2 } = await loadFixture(deployGFTCoinICOFixture);
            const minInvestment = hre.ethers.parseEther("0.1");
            const maxInvestment = hre.ethers.parseEther("5");

            // Investimento válido dentro do intervalo permitido
            await expect(gftCoinICO.connect(investor1).invest({ value: minInvestment })).to.not.be.reverted;
            await expect(gftCoinICO.connect(investor2).invest({ value: maxInvestment })).to.not.be.reverted;

            const investor1Balance = await gftCoinICO.balanceOf(investor1.address)
            expect(investor1Balance).to.be.greaterThan(0)

            const investor2Balance = await gftCoinICO.balanceOf(investor2.address)
            expect(investor2Balance).to.be.greaterThan(0)


        });

        it("Should revert if investment is below min or above max range", async () => {
            const { gftCoinICO, investor1 } = await loadFixture(deployGFTCoinICOFixture);
            const belowMinInvestment = hre.ethers.parseEther("0.05");
            const aboveMaxInvestment = hre.ethers.parseEther("10");

            await expect(gftCoinICO.connect(investor1).invest({ value: belowMinInvestment })).to.be.revertedWithCustomError(
                gftCoinICO,
                "ICOoutOfRangeInvesment"
            );
            await expect(gftCoinICO.connect(investor1).invest({ value: aboveMaxInvestment })).to.be.revertedWithCustomError(
                gftCoinICO,
                "ICOoutOfRangeInvesment"
            );
        });

        it("Should revert if hardCap is exceeded (using ICOhardCapReached)", async () => {
            const { gftCoinICO, investor1 } = await loadFixture(deployGFTCoinICOFixture);
            const hardCap = await gftCoinICO.hardCap();
            const investmentAmount = hre.ethers.parseEther("5");

            for (let i = 0; i < 60; i++) {
                await gftCoinICO.connect(investor1).invest({ value: investmentAmount});
            }
            await expect(gftCoinICO.connect(investor1).invest({ value: investmentAmount }))
                .to.be.revertedWithCustomError(gftCoinICO, "ICOhardCapReached");
        });        
    });

    describe("Event Emissions", () => {
        it("Should emit an event on investment", async () => {
            const { gftCoinICO, investor1 } = await loadFixture(deployGFTCoinICOFixture);
            const investmentAmount = hre.ethers.parseEther("1");

            await expect(gftCoinICO.connect(investor1).invest({ value: investmentAmount }))
                .to.emit(gftCoinICO, "InvestmentReceived")
                .withArgs(investor1.address, investmentAmount, anyValue);
        });
    });

    describe("Token Transfer Restrictions", () => {
        it("Should revert with TradeDoesNotStart error if transfer is attempted before tradeStart", async () => {
            const { gftCoinICO, investor1, investor2 } = await loadFixture(deployGFTCoinICOFixture);
            const maxInvestment = hre.ethers.parseEther("5");

            await expect(gftCoinICO.connect(investor1).invest({ value: maxInvestment }));
            await expect(gftCoinICO.connect(investor1).transfer(investor2.address, 5))
                .to.be.revertedWithCustomError(gftCoinICO, "TradeDoesNotStart");
        });

        it("Should allow transfer of tokens after tradeStart", async () => {
            const { gftCoinICO, investor1, investor2 } = await loadFixture(deployGFTCoinICOFixture);
            const maxInvestment = hre.ethers.parseEther("5");

            // Investimento válido dentro do intervalo permitido
            await expect(gftCoinICO.connect(investor1).invest({ value: maxInvestment })).to.not.be.reverted;
            // Avançar o tempo para depois de tradeStart
            await time.increaseTo(await gftCoinICO.tradeStart());

            expect(await gftCoinICO.balanceOf(investor2.address)).to.equal(0);

            // Realizar transferência de tokens com sucesso após tradeStart
            await expect(gftCoinICO.connect(investor1).transfer(investor2.address, 100)).to.not.be.reverted;

            expect(await gftCoinICO.balanceOf(investor2.address)).to.equal(100);
        });
    });
});
