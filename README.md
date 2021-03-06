# smoke-tester

Tests the Commonwealth app using a headless browser to ensure
governance and chain-related pages are working.

When tests are completed, results are posted to a Slack channel
and screenshots are posted to IPFS for diagnostic purposes.

### Setup

Go to http://chromedriver.storage.googleapis.com/index.html and
download a recent version of the web driver.

Move it into your PATH (e.g. into this directory). Then, run:

```
yarn install
```

(Optional) Install and run an IPFS client in the background, so the smoke tests can post screenshots:

```
sudo snap install ipfs
ipfs --daemon &
```


### Usage

To run smoke tests, specifying which test(s) you want to run (will run all tests if none are specified):

```
yarn test [api|ui|deps]
```

To schedule the smoke tests:

```
yarn schedule [api|ui|deps]
```
