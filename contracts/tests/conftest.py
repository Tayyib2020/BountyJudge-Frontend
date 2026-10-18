"""Project-local compatibility shim for Direct Mode on Windows.

genlayer-test 0.29.2 replaces fd 0 with a temporary message file, then unlinks
that file while fd 0 is still open. Windows forbids that unlink. Keep the
message files in the project's local cache until VM cleanup restores stdin.
"""

import os
import sys
import tempfile
from pathlib import Path


if sys.platform == "win32":
    from gltest.direct import loader
    from gltest.direct.vm import VMContext

    _CACHE_DIR = Path(__file__).resolve().parents[1] / ".cache" / "genlayer" / "stdin"
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _ORIGINAL_CLEANUP = VMContext._cleanup_after_deactivate

    def _inject_message_to_fd0_windows(vm):
        from genlayer.py import calldata
        from genlayer.py.types import Address

        sender = Address(vm.sender) if isinstance(vm.sender, bytes) else vm.sender
        contract = Address(vm._contract_address) if isinstance(vm._contract_address, bytes) else vm._contract_address
        origin = Address(vm.origin) if isinstance(vm.origin, bytes) else vm.origin
        message = {
            "contract_address": contract,
            "sender_address": sender,
            "origin_address": origin,
            "stack": [],
            "value": vm._value,
            "datetime": vm._datetime,
            "is_init": False,
            "chain_id": vm._chain_id,
            "entry_kind": 0,
            "entry_data": b"",
            "entry_stage_data": None,
        }
        fd, path = tempfile.mkstemp(dir=_CACHE_DIR)
        os.write(fd, calldata.encode(message))
        os.lseek(fd, 0, os.SEEK_SET)
        vm._original_stdin_fd = os.dup(0)
        os.dup2(fd, 0)
        os.close(fd)
        paths = getattr(vm, "_bountyjudge_stdin_paths", [])
        paths.append(path)
        vm._bountyjudge_stdin_paths = paths

    def _cleanup_after_deactivate_windows(self):
        _ORIGINAL_CLEANUP(self)
        for path in getattr(self, "_bountyjudge_stdin_paths", []):
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
        self._bountyjudge_stdin_paths = []

    loader._inject_message_to_fd0 = _inject_message_to_fd0_windows
    VMContext._cleanup_after_deactivate = _cleanup_after_deactivate_windows


import pytest


@pytest.fixture(autouse=True)
def _strict_direct_mode(direct_vm):
    """Enable every strictness switch exposed by genlayer-test 0.29.2."""
    direct_vm.strict_mocks = True
    # The installed WASI mock checks this internal flag for fail-fast matching.
    direct_vm._strict_mock_mode = True
    direct_vm.check_pickling = True
    yield
