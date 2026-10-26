defmodule BeefChatTest do
  use ExUnit.Case, async: true

  test "message ids are RFC 4122 version 4 UUIDs" do
    id = BeefChat.Id.uuid4()
    assert id =~ ~r/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    refute id == BeefChat.Id.uuid4()
  end

  test "garbage and missing tokens are rejected" do
    assert BeefChat.Auth.verify("not-a-jwt") == :error
    assert BeefChat.Auth.verify(nil) == :error
  end

  test "internal token comparison" do
    assert BeefChat.Auth.internal_token_valid?("test-internal-token-123")
    refute BeefChat.Auth.internal_token_valid?("test-internal-token-124")
    refute BeefChat.Auth.internal_token_valid?("short")
    refute BeefChat.Auth.internal_token_valid?(nil)
  end
end
