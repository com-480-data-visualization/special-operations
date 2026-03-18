#!/usr/bin/env zsh

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip

# if any packages in the requirements.txt file don't exist, install.
# otherwise skip
if [ -z "$(diff =(pip freeze) requirements.txt)" ]; then
    echo "All packages are up to date."
else
    echo "Missing packages; installing."
    pip install -r requirements.txt
fi
